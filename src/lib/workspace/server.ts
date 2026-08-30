import "server-only";
import { Redis } from "@upstash/redis";
import { emptyWorkspace, type Note, type Source, type WorkspaceOp, type WorkspaceState } from "./types";
import type { Participant } from "./types";

/**
 * Shared workspace persistence.
 *
 * The workspace is stored as separate Redis structures rather than one JSON blob,
 * so concurrent writers don't contend: appending a note is RPUSH, adding a source
 * is HSETNX, and each is atomic on its own. A single blob with compare-and-set
 * loses writes as soon as two agents work at the same time — which is the whole
 * point of this app.
 *
 * Upstash is provisioned through the Vercel Marketplace, so credentials arrive as
 * KV_REST_API_* rather than the UPSTASH_* names `Redis.fromEnv()` expects.
 */
let client: Redis | null = null;

function redis(): Redis {
  if (!client) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error("Redis is not configured (KV_REST_API_URL / KV_REST_API_TOKEN).");
    }
    client = new Redis({ url, token });
  }
  return client;
}

/** Demo artifacts, not archives — a week after the last write. */
const TTL_SECONDS = 60 * 60 * 24 * 7;
/** A participant that hasn't checked in for this long is treated as gone. */
const PARTICIPANT_TIMEOUT_MS = 90_000;

const keys = (id: string) => ({
  meta: `ws:${id}:meta`,
  sources: `ws:${id}:sources`,
  notes: `ws:${id}:notes`,
  participants: `ws:${id}:participants`,
  version: `ws:${id}:version`,
});

function parse<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return null;
  }
}

/** Refreshes a participant's lastSeen, if they are already known. */
async function markSeen(id: string, participantId: string) {
  const k = keys(id);
  const existing = parse<Participant>(await redis().hget(k.participants, participantId));
  if (!existing) return;
  await redis().hset(k.participants, {
    [participantId]: JSON.stringify({ ...existing, lastSeen: Date.now() }),
  });
}

async function touch(id: string) {
  const k = keys(id);
  const r = redis();
  await Promise.all(Object.values(k).map((key) => r.expire(key, TTL_SECONDS)));
}

export async function readWorkspace(id: string): Promise<WorkspaceState> {
  const k = keys(id);
  const r = redis();

  const [meta, sources, notes, participants, version] = await Promise.all([
    r.hgetall<Record<string, string>>(k.meta),
    r.hgetall<Record<string, string>>(k.sources),
    r.lrange<string>(k.notes, 0, -1),
    r.hgetall<Record<string, string>>(k.participants),
    r.get<number>(k.version),
  ]);

  const base = emptyWorkspace(id);

  return {
    ...base,
    topic: typeof meta?.topic === "string" ? meta.topic : "",
    sources: Object.values(sources ?? {})
      .map((value) => parse<Source>(value))
      .filter((source): source is Source => source !== null)
      .sort((a, b) => a.addedAt - b.addedAt),
    notes: (notes ?? [])
      .map((value) => parse<Note>(value))
      .filter((note): note is Note => note !== null),
    participants: Object.values(participants ?? {})
      .map((value) => parse<Participant>(value))
      .filter((p): p is Participant => p !== null)
      // Drop tabs that stopped checking in, so the list reflects who is actually here.
      .filter((p) => Date.now() - p.lastSeen < PARTICIPANT_TIMEOUT_MS)
      .sort((a, b) => a.joinedAt - b.joinedAt),
    version: Number(version ?? 0),
    updatedAt: Date.now(),
  };
}

/** Applies one operation atomically, then returns the whole workspace. */
export async function mutateWorkspace(
  id: string,
  op: WorkspaceOp,
): Promise<WorkspaceState> {
  const k = keys(id);
  const r = redis();
  const now = Date.now();

  switch (op.type) {
    case "join": {
      const existing = parse<Participant>(
        await r.hget(k.participants, op.participant.id),
      );
      const participant: Participant = {
        ...op.participant,
        joinedAt: existing?.joinedAt ?? now,
        lastSeen: now,
      };
      await r.hset(k.participants, { [op.participant.id]: JSON.stringify(participant) });
      break;
    }

    case "set_topic":
      await r.hset(k.meta, { topic: op.topic });
      break;

    case "add_source": {
      const source: Source = { ...op.source, addedAt: now };
      // HSETNX: first writer wins, so two agents collecting the same video is safe.
      await r.hsetnx(k.sources, op.source.videoId, JSON.stringify(source));
      break;
    }

    case "remove_source":
      await r.hdel(k.sources, op.videoId);
      break;

    case "set_transcript":
    case "set_transcript_error": {
      const current = parse<Source>(await r.hget(k.sources, op.videoId));
      if (!current) break;
      const updated: Source =
        op.type === "set_transcript"
          ? { ...current, transcript: op.segments, transcriptError: undefined, transcriptFrom: op.from }
          : { ...current, transcriptError: op.message };
      await r.hset(k.sources, { [op.videoId]: JSON.stringify(updated) });
      break;
    }

    case "add_note": {
      const note: Note = { ...op.note, id: crypto.randomUUID(), createdAt: now };
      // RPUSH is atomic — parallel writers never lose a note.
      await r.rpush(k.notes, JSON.stringify(note));
      // Filing work counts as being present: a long-running agent that writes
      // steadily should never be pruned as absent between heartbeats.
      await markSeen(id, op.note.authorId);
      break;
    }

    case "remove_note": {
      const stored = await r.lrange<string>(k.notes, 0, -1);
      const match = (stored ?? []).find((value) => parse<Note>(value)?.id === op.noteId);
      if (match) await r.lrem(k.notes, 1, match);
      break;
    }
  }

  await r.incr(k.version);
  await touch(id);
  return readWorkspace(id);
}
