"use client";

import { useState } from "react";
import { useWorkspace, type Focus, type Note, type Source } from "@/lib/workspace-store";
import { useWorkspaceActions } from "@/lib/workspace-actions";
import { useResearchTeam } from "@/lib/team-client";
import { useSourceQnA } from "@/lib/rag-client";
import { abstractUrl, quoteUrl } from "@/lib/papers/types";
import { isActive as isParticipantActive } from "@/lib/workspace/types";



function isActive(focus: Focus, kind: Focus["kind"], sourceId?: string) {
  if (focus.kind !== kind) return false;
  return focus.kind === "source" ? focus.sourceId === sourceId : true;
}

export function Workspace() {
  const { shared, results, focus, busy, offline, identity, setFocus, apply } = useWorkspace();
  const { topic, sources, notes, participants } = shared;

  /**
   * Who to name in the footer.
   *
   * Anyone still checking in, plus anyone who left something behind. A browser
   * that opened the link once and wandered off is not a collaborator, and
   * listing it forever just makes the line unreadable.
   */
  const visibleParticipants = participants.filter(
    (p) =>
      isParticipantActive(p) ||
      p.id === identity.id ||
      notes.some((note) => note.authorId === p.id),
  );
  const { searchOrCollect, collectSource, loadFullText } = useWorkspaceActions();
  const { dispatchTeam } = useResearchTeam();
  const { askAndRecord } = useSourceQnA();
  const [dispatching, setDispatching] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [draftQuery, setDraftQuery] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeSource =
    focus.kind === "source"
      ? sources.find((source) => source.sourceId === focus.sourceId)
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
            const outcome = await searchOrCollect(draftQuery.trim());
            if (outcome.kind === "collected") {
              setFocus({ kind: "source", sourceId: outcome.source.sourceId });
              setDraftQuery("");
            } else {
              setFocus({ kind: "results" });
            }
          });
        }}
      >
        <input
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          placeholder="Search a topic, or paste an arXiv link…"
          value={draftQuery}
          onChange={(event) => setDraftQuery(event.target.value)}
          aria-label="Search arXiv"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={!draftQuery.trim() || dispatching}
          onClick={() => {
            const topic = draftQuery.trim();
            if (!topic) return;
            setDispatching(true);
            void guard(async () => {
              await dispatchTeam(topic);
              setFocus({ kind: "notes" });
            }).then(() => setDispatching(false));
          }}
          className="rounded-md border border-black/15 px-3 py-1.5 text-xs transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
        >
          {dispatching ? "Dispatching…" : "Send the research team"}
        </button>
        <span className="text-xs text-foreground/40">
          Scout → Reader → Critic → Synthesist, filing into this workspace
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
          {error}
        </p>
      )}

      {sources.some((source) => source.passages?.length) && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const q = question.trim();
            if (!q || asking) return;
            setAsking(true);
            setQuestion("");
            void guard(async () => {
              await askAndRecord(q);
              setFocus({ kind: "notes" });
            }).then(() => setAsking(false));
          }}
        >
          <input
            className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
            placeholder="Ask the collected papers a question…"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-label="Ask the papers"
          />
          <button
            type="submit"
            disabled={!question.trim() || asking}
            className="rounded-md border border-black/15 px-3 py-2 text-sm transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
          >
            {asking ? "Asking…" : "Ask"}
          </button>
        </form>
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
                key={source.sourceId}
                type="button"
                onClick={() => setFocus({ kind: "source", sourceId: source.sourceId })}
                aria-current={isActive(focus, "source", source.sourceId)}
                className={tabClass(isActive(focus, "source", source.sourceId))}
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
              onCollect={(sourceId) => void guard(() => collectSource(sourceId))}
              collected={new Set(sources.map((source) => source.sourceId))}
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
                onLoadFullText={() => {
                  // A missing full text is an expected outcome, not an app error:
                  // it is already reported on the source itself, so don't also
                  // raise the page-level error banner and say it twice.
                  setError(null);
                  void loadFullText(activeSource.sourceId).catch(() => {});
                }}
                onRemove={() => {
                  void guard(async () => {
                    await apply({ type: "remove_source", sourceId: activeSource.sourceId });
                    setFocus({ kind: "results" });
                  });
                }}
                onCite={(section, quote) => {
                  void guard(async () => {
                    await apply({
                      type: "add_note",
                      note: {
                        authorId: identity.id,
                        authorLabel: identity.label,
                        authorKind: identity.kind,
                        text: "",
                        anchor: { sourceId: activeSource.sourceId, section, quote },
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
          {visibleParticipants.length === 0
            ? "just you"
            : visibleParticipants.map((p, index) => (
                <span
                  key={p.id}
                  className={isParticipantActive(p) ? undefined : "opacity-50"}
                  title={isParticipantActive(p) ? "here now" : "finished — no longer active"}
                >
                  {index > 0 && ", "}
                  {p.label}
                  {p.id === identity.id && " (you)"}
                </span>
              ))}
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
  onCollect: (sourceId: string) => void;
  collected: Set<string>;
}) {
  const { results, lastQuery } = useWorkspace();

  // Only report a failed search if *this* browser actually ran one.
  if (results.length === 0 && lastQuery) {
    return (
      <p className="text-sm text-foreground/50">
        No papers found for &ldquo;{lastQuery}&rdquo;. Try different wording — arXiv matches
        on title, abstract and authors.
      </p>
    );
  }

  if (results.length === 0) {
    return (
      <p className="text-sm text-foreground/50">
        Search a topic or paste an arXiv link above, send the research team, or ask your agent
        to find sources. Anything collected appears under Sources.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
      {results.map((paper) => (
        <li key={paper.sourceId} className="flex gap-3 py-3">
          <div className="min-w-0 flex-1">
            <a
              href={abstractUrl(paper.sourceId)}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium hover:underline"
            >
              {paper.title}
            </a>
            <p className="mt-0.5 text-xs text-foreground/50">
              {paper.authors.slice(0, 3).join(", ")}
              {paper.authors.length > 3 && " et al."} · {paper.published}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-foreground/60">{paper.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => onCollect(paper.sourceId)}
            disabled={collected.has(paper.sourceId)}
            className="h-fit shrink-0 rounded-md border border-black/15 px-2.5 py-1 text-xs transition-colors hover:bg-black/5 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
          >
            {collected.has(paper.sourceId) ? "Collected" : "Collect"}
          </button>
        </li>
      ))}
    </ul>
  );
}

function SourcePane({
  source,
  onLoadFullText,
  onRemove,
  onCite,
}: {
  source: Source;
  onLoadFullText: () => void;
  onRemove: () => void;
  onCite: (section: string, quote: string) => void;
}) {
  return (
    <article className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={abstractUrl(source.sourceId)}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium hover:underline"
          >
            {source.title}
          </a>
          <p className="mt-0.5 text-xs text-foreground/50">
            {source.authors.slice(0, 4).join(", ")}
            {source.authors.length > 4 && " et al."} · {source.published} · {source.sourceId}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded px-2 py-1 text-xs text-foreground/50 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        >
          Remove
        </button>
      </header>

      {source.passages ? (
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          {source.passages.map((passage, index) => (
            <div key={index} className="group flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wide text-foreground/40">
                  {passage.section}
                </span>
                <button
                  type="button"
                  onClick={() => onCite(passage.section, passage.text)}
                  className="rounded px-1.5 py-0.5 text-xs text-foreground/0 transition-colors group-hover:text-foreground/50 hover:bg-black/5 hover:!text-foreground dark:hover:bg-white/10"
                >
                  Cite
                </button>
              </div>
              <p className="text-sm leading-relaxed">{passage.text}</p>
            </div>
          ))}
        </div>
      ) : source.fullTextError ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            {source.fullTextError}
          </p>
          <p className="text-sm text-foreground/60">{source.summary}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onLoadFullText}
            className="w-fit rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Read the full text
          </button>
          <p className="text-sm text-foreground/60">{source.summary}</p>
        </div>
      )}
    </article>
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
                      href={quoteUrl(note.anchor.sourceId, note.anchor.quote)}
                      target="_blank"
                      rel="noreferrer"
                      title="Open the paper at this passage"
                      className="italic hover:underline"
                    >
                      &ldquo;{note.anchor.quote}&rdquo;
                    </a>
                    {note.anchor.section && (
                      <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-foreground/40">
                        {note.anchor.section}
                      </span>
                    )}
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
