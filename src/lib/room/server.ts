import "server-only";
import { Redis } from "@upstash/redis";
import { emptyRoom, type Finding, type Participant, type RoomOp, type RoomState } from "./types";

/**
 * Shared room persistence.
 *
 * Stored as separate Redis structures rather than one JSON document, so
 * concurrent writers don't contend: filing a finding is an atomic RPUSH. A
 * single document with compare-and-set loses writes as soon as two agents work
 * at once — which is the normal case here, not an edge case.
 *
 * Upstash is provisioned through the Vercel Marketplace, so credentials arrive
 * as KV_REST_API_* rather than the UPSTASH_* names `Redis.fromEnv()` expects.
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

const TTL_SECONDS = 60 * 60 * 24 * 7;

const keys = (id: string) => ({
  findings: `room:${id}:findings`,
  participants: `room:${id}:participants`,
  version: `room:${id}:version`,
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

async function markSeen(id: string, participantId: string) {
  const k = keys(id);
  const existing = parse<Participant>(await redis().hget(k.participants, participantId));
  if (!existing) return;
  await redis().hset(k.participants, {
    [participantId]: JSON.stringify({ ...existing, lastSeen: Date.now() }),
  });
}

async function touch(id: string) {
  const r = redis();
  await Promise.all(Object.values(keys(id)).map((key) => r.expire(key, TTL_SECONDS)));
}

export async function readRoom(id: string): Promise<RoomState> {
  const k = keys(id);
  const r = redis();

  const [findings, participants, version] = await Promise.all([
    r.lrange<string>(k.findings, 0, -1),
    r.hgetall<Record<string, string>>(k.participants),
    r.get<number>(k.version),
  ]);

  return {
    ...emptyRoom(id),
    findings: (findings ?? [])
      .map((value) => parse<Finding>(value))
      .filter((finding): finding is Finding => finding !== null),
    participants: Object.values(participants ?? {})
      .map((value) => parse<Participant>(value))
      .filter((p): p is Participant => p !== null)
      .sort((a, b) => a.joinedAt - b.joinedAt),
    version: Number(version ?? 0),
    updatedAt: Date.now(),
  };
}

/** Rewrites one finding in place, preserving list order. */
async function replaceFinding(
  id: string,
  findingId: string,
  update: (finding: Finding) => Finding,
) {
  const k = keys(id);
  const stored = (await redis().lrange<string>(k.findings, 0, -1)) ?? [];
  const index = stored.findIndex((value) => parse<Finding>(value)?.id === findingId);
  if (index === -1) return;
  const current = parse<Finding>(stored[index]);
  if (!current) return;
  await redis().lset(k.findings, index, JSON.stringify(update(current)));
}

export async function mutateRoom(id: string, op: RoomOp): Promise<RoomState> {
  const k = keys(id);
  const r = redis();
  const now = Date.now();

  switch (op.type) {
    case "join": {
      const existing = parse<Participant>(await r.hget(k.participants, op.participant.id));
      await r.hset(k.participants, {
        [op.participant.id]: JSON.stringify({
          ...op.participant,
          joinedAt: existing?.joinedAt ?? now,
          lastSeen: now,
        }),
      });
      break;
    }

    case "file_finding": {
      const finding: Finding = {
        ...op.finding,
        id: crypto.randomUUID(),
        status: "open",
        createdAt: now,
      };
      await r.rpush(k.findings, JSON.stringify(finding));
      // Filing work counts as presence: a long analysis should not look absent.
      await markSeen(id, op.finding.authorId);
      break;
    }

    case "set_status":
      await replaceFinding(id, op.findingId, (finding) => ({
        ...finding,
        status: op.status,
        verdictNote: op.verdictNote ?? finding.verdictNote,
      }));
      break;

    case "remove_finding": {
      const stored = (await r.lrange<string>(k.findings, 0, -1)) ?? [];
      const match = stored.find((value) => parse<Finding>(value)?.id === op.findingId);
      if (match) await r.lrem(k.findings, 1, match);
      break;
    }
  }

  await r.incr(k.version);
  await touch(id);
  return readRoom(id);
}
