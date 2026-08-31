"use client";

import { useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { useSourceQnA } from "@/lib/rag-client";
import type { Source } from "@/lib/workspace/types";
import { extractPaperId, isUnsupportedLink, type PaperResult, type Passage } from "@/lib/papers/types";

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
  return body;
}

/**
 * The operations the human UI and the WebMCP tools share.
 *
 * Every mutation goes through `apply`, which writes to the shared workspace and
 * returns the authoritative state — so a click and a tool call are the same
 * operation, and both are visible to everyone else in the workspace.
 */
export function useWorkspaceActions() {
  const { apply, readLive, identity, setResults, setLastQuery, setBusy } = useWorkspace();
  const { indexSource } = useSourceQnA();

  const runSearch = useCallback(
    async (query: string, { limit = 8 }: { limit?: number } = {}): Promise<PaperResult[]> => {
      setBusy(true);
      try {
        const response = await fetch(
          `/api/papers/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        );
        const body = await readJson<{ results: PaperResult[] }>(response);
        setResults(body.results);
        setLastQuery(query);
        await apply({ type: "set_topic", topic: query });
        return body.results;
      } finally {
        setBusy(false);
      }
    },
    [apply, setBusy, setResults, setLastQuery],
  );

  const collectSource = useCallback(
    async (sourceId: string): Promise<Source> => {
      const existing = readLive().sources.find((source) => source.sourceId === sourceId);
      if (existing) return existing;

      const paper = await readJson<PaperResult>(
        await fetch(`/api/papers/paper?sourceId=${encodeURIComponent(sourceId)}`),
      );
      const state = await apply({
        type: "add_source",
        source: { ...paper, addedBy: identity.label },
      });
      return (
        state.sources.find((source) => source.sourceId === sourceId) ?? {
          ...paper,
          addedAt: Date.now(),
          addedBy: identity.label,
        }
      );
    },
    [apply, identity.label, readLive],
  );

  const loadFullText = useCallback(
    async (sourceId: string): Promise<Passage[]> => {
      const cached = readLive().sources.find((s) => s.sourceId === sourceId)?.passages;
      if (cached) return cached;

      try {
        const body = await readJson<{ passages: Passage[] }>(
          await fetch(`/api/papers/fulltext?sourceId=${encodeURIComponent(sourceId)}`),
        );
        await apply({ type: "set_passages", sourceId, passages: body.passages });
        indexSource(sourceId);
        return body.passages;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Full text failed.";
        await apply({ type: "set_fulltext_error", sourceId, message });
        throw error;
      }
    },
    [apply, readLive, indexSource],
  );

  /** Pasting an arXiv link means "work with that paper", not "search for this string". */
  const searchOrCollect = useCallback(
    async (
      input: string,
      options: { limit?: number } = {},
    ): Promise<
      { kind: "collected"; source: Source } | { kind: "searched"; results: PaperResult[] }
    > => {
      if (isUnsupportedLink(input)) {
        throw new Error(
          "YouGo reads papers from arXiv. Paste an arXiv link or id (like 2210.03629), or type a topic to search for.",
        );
      }

      const sourceId = extractPaperId(input);
      if (sourceId) {
        setBusy(true);
        try {
          return { kind: "collected", source: await collectSource(sourceId) };
        } finally {
          setBusy(false);
        }
      }
      return { kind: "searched", results: await runSearch(input, options) };
    },
    [collectSource, runSearch, setBusy],
  );

  return { runSearch, collectSource, loadFullText, searchOrCollect };
}
