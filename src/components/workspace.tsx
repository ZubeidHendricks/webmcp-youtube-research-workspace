"use client";

import { useState } from "react";
import { useWorkspace, type Focus, type Note, type Source } from "@/lib/workspace-store";
import { useWorkspaceActions } from "@/lib/workspace-actions";

function watchUrl(videoId: string, seconds?: number) {
  return `https://www.youtube.com/watch?v=${videoId}${seconds ? `&t=${seconds}s` : ""}`;
}

function isActive(focus: Focus, kind: Focus["kind"], videoId?: string) {
  if (focus.kind !== kind) return false;
  return focus.kind === "source" ? focus.videoId === videoId : true;
}

export function Workspace() {
  const { shared, results, focus, busy, offline, identity, setFocus, apply } = useWorkspace();
  const { topic, sources, notes, participants } = shared;
  const { searchOrCollect, collectSource, loadTranscript } = useWorkspaceActions();
  const [draftQuery, setDraftQuery] = useState("");
  const [captionedOnly, setCaptionedOnly] = useState(true);
  const [draftNote, setDraftNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeSource =
    focus.kind === "source"
      ? sources.find((source) => source.videoId === focus.videoId)
      : undefined;

  async function guard(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draftQuery.trim()) return;
          void guard(async () => {
            const outcome = await searchOrCollect(draftQuery.trim(), { captionedOnly });
            if (outcome.kind === "collected") {
              setFocus({ kind: "source", videoId: outcome.source.videoId });
              setDraftQuery("");
            } else {
              setFocus({ kind: "results" });
            }
          });
        }}
      >
        <input
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          placeholder="Search a topic, or paste a YouTube URL…"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          aria-label="Search YouTube"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      <label className="-mt-2 flex items-center gap-2 text-xs text-foreground/50">
        <input
          type="checkbox"
          className="size-3.5 accent-current"
          checked={captionedOnly}
          onChange={(event) => setCaptionedOnly(event.target.checked)}
        />
        Prefer videos with caption tracks
      </label>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
            Sources ({sources.length})
          </h2>
          <nav className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setFocus({ kind: "results" })}
              aria-current={isActive(focus, "results")}
              className={tabClass(isActive(focus, "results"))}
            >
              Results {results.length > 0 && `(${results.length})`}
            </button>
            <button
              type="button"
              onClick={() => setFocus({ kind: "notes" })}
              aria-current={isActive(focus, "notes")}
              className={tabClass(isActive(focus, "notes"))}
            >
              Notes ({notes.length})
            </button>
            {sources.length > 0 && (
              <p className="mt-3 px-2 text-xs text-foreground/40">Collected</p>
            )}
            {sources.map((source) => (
              <button
                key={source.videoId}
                type="button"
                onClick={() => setFocus({ kind: "source", videoId: source.videoId })}
                aria-current={isActive(focus, "source", source.videoId)}
                className={tabClass(isActive(focus, "source", source.videoId))}
                title={source.title}
              >
                <span className="line-clamp-2 text-left">{source.title}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          {focus.kind === "results" && (
            <ResultsPane
              onCollect={(videoId) => void guard(() => collectSource(videoId))}
              collected={new Set(sources.map((source) => source.videoId))}
            />
          )}

          {focus.kind === "notes" && (
            <NotesPane
              notes={notes}
              onRemove={(id) => void guard(() => apply({ type: "remove_note", noteId: id }))}
              draft={draftNote}
              setDraft={setDraftNote}
              onSubmit={() => {
                if (!draftNote.trim()) return;
                const text = draftNote.trim();
                setDraftNote("");
                void guard(() =>
                  apply({
                    type: "add_note",
                    note: {
                      authorId: identity.id,
                      authorLabel: identity.label,
                      authorKind: identity.kind,
                      text,
                    },
                  }),
                );
              }}
            />
          )}

          {focus.kind === "source" &&
            (activeSource ? (
              <SourcePane
                source={activeSource}
                onLoadTranscript={() =>
                  void guard(() => loadTranscript(activeSource.videoId))
                }
                onRemove={() => {
                  void guard(async () => {
                    await apply({ type: "remove_source", videoId: activeSource.videoId });
                    setFocus({ kind: "results" });
                  });
                }}
                onCite={(seconds, timestamp, quote) => {
                  void guard(async () => {
                    await apply({
                      type: "add_note",
                      note: {
                        authorId: identity.id,
                        authorLabel: identity.label,
                        authorKind: identity.kind,
                        text: "",
                        anchor: { videoId: activeSource.videoId, seconds, timestamp, quote },
                      },
                    });
                    setFocus({ kind: "notes" });
                  });
                }}
              />
            ) : (
              <p className="text-sm text-foreground/50">That source is no longer collected.</p>
            ))}
        </main>
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/40">
        {topic && <span>Topic: {topic}</span>}
        <span>
          In this workspace:{" "}
          {participants.length === 0
            ? "just you"
            : participants
                .map((p) => `${p.label}${p.id === identity.id ? " (you)" : ""}`)
                .join(", ")}
        </span>
        {offline && <span className="text-amber-600 dark:text-amber-400">{offline}</span>}
      </footer>
    </div>
  );
}

function tabClass(active: boolean) {
  return `rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
    active
      ? "bg-foreground text-background"
      : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10"
  }`;
}

function ResultsPane({
  onCollect,
  collected,
}: {
  onCollect: (videoId: string) => void;
  collected: Set<string>;
}) {
  const { results, shared } = useWorkspace();
  const topic = shared.topic;

  if (results.length === 0 && topic) {
    return (
      <p className="text-sm text-foreground/50">
        No results for &ldquo;{topic}&rdquo;. Try different wording, or untick &ldquo;prefer
        videos with caption tracks&rdquo; to widen the search.
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="text-sm text-foreground/50">
        Search a topic or paste a YouTube URL above — or ask your agent to find sources.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
      {results.map((video) => (
        <li key={video.videoId} className="flex gap-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnail}
            alt=""
            className="h-16 w-28 shrink-0 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <a
              href={watchUrl(video.videoId)}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-2 text-sm font-medium hover:underline"
            >
              {video.title}
            </a>
            <p className="mt-0.5 text-xs text-foreground/50">{video.channelTitle}</p>
          </div>
          <button
            type="button"
            onClick={() => onCollect(video.videoId)}
            disabled={collected.has(video.videoId)}
            className="h-fit shrink-0 rounded-md border border-black/15 px-2.5 py-1 text-xs transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
          >
            {collected.has(video.videoId) ? "Collected" : "Collect"}
          </button>
        </li>
      ))}
    </ul>
  );
}

function SourcePane({
  source,
  onLoadTranscript,
  onRemove,
  onCite,
}: {
  source: Source;
  onLoadTranscript: () => void;
  onRemove: () => void;
  onCite: (seconds: number, timestamp: string, quote: string) => void;
}) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={watchUrl(source.videoId)}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium hover:underline"
          >
            {source.title}
          </a>
          <p className="mt-0.5 text-xs text-foreground/50">{source.channelTitle}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded px-2 py-1 text-xs text-foreground/50 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        >
          Remove
        </button>
      </header>

      {source.transcript ? (
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto pr-1">
          {source.transcript.map((segment, index) => (
            <li key={`${segment.seconds}-${index}`} className="group flex gap-2 text-sm">
              <a
                href={watchUrl(source.videoId, segment.seconds)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-mono text-xs text-foreground/40 hover:text-foreground hover:underline"
              >
                {segment.timestamp}
              </a>
              <span className="flex-1">{segment.text}</span>
              <button
                type="button"
                onClick={() => onCite(segment.seconds, segment.timestamp, segment.text)}
                className="h-fit shrink-0 rounded px-1.5 py-0.5 text-xs text-foreground/0 transition-colors group-hover:text-foreground/50 hover:bg-black/5 hover:!text-foreground dark:hover:bg-white/10"
              >
                Cite
              </button>
            </li>
          ))}
        </ul>
      ) : source.transcriptError ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            {source.transcriptError}
          </p>
          <TranscriptFallback />
        </div>
      ) : (
        <button
          type="button"
          onClick={onLoadTranscript}
          className="w-fit rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Load transcript
        </button>
      )}
    </article>
  );
}

/**
 * Shown when a transcript can't be fetched server-side.
 *
 * Finding the words is the agent's job, never the researcher's: it reads the video
 * and sends the lines back with `provide_transcript`, after which this pane renders
 * a normal citable transcript. There is deliberately no hand-entry form here.
 */
function TranscriptFallback() {
  return (
    <div className="rounded-md border border-black/10 px-3 py-2.5 text-sm dark:border-white/15">
      <p className="font-medium">Ask your agent to read this one.</p>
      <p className="mt-1 text-foreground/60">
        It can watch the video and send the transcript back with{" "}
        <code className="font-mono text-xs">provide_transcript</code> — the lines land here
        and become citable, exactly like a fetched transcript.
      </p>
    </div>
  );
}

function NotesPane({
  notes,
  onRemove,
  draft,
  setDraft,
  onSubmit,
}: {
  notes: Note[];
  onRemove: (id: string) => void;
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          placeholder="Add a note…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="New note"
        />
        <button
          type="submit"
          className="rounded-md border border-black/15 px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Add
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-foreground/50">
          No notes yet. Cite a transcript moment, or ask your agent to.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-3 py-3">
              <span
                className={`mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  note.authorKind === "agent"
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                    : "bg-black/5 text-foreground/50 dark:bg-white/10"
                }`}
              >
                {note.authorLabel}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                {note.anchor && (
                  <p className="text-foreground/80">
                    <a
                      href={watchUrl(note.anchor.videoId, note.anchor.seconds)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-foreground/40 hover:text-foreground hover:underline"
                    >
                      {note.anchor.timestamp}
                    </a>{" "}
                    <span className="italic">&ldquo;{note.anchor.quote}&rdquo;</span>
                  </p>
                )}
                {note.text && <p className="mt-1">{note.text}</p>}
              </div>
              <button
                type="button"
                onClick={() => onRemove(note.id)}
                className="h-fit shrink-0 rounded px-2 py-1 text-xs text-foreground/40 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                aria-label="Delete note"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
