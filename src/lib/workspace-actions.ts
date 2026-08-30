"use client";

import { useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import type { Source } from "@/lib/workspace/types";
import { extractVideoId, type TranscriptSegment, type VideoResult } from "@/lib/youtube/types";

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

  const runSearch = useCallback(
    async (
      query: string,
      { limit = 8, captionedOnly = true }: { limit?: number; captionedOnly?: boolean } = {},
    ): Promise<VideoResult[]> => {
      setBusy(true);
      try {
        const response = await fetch(
          `/api/youtube/search?q=${encodeURIComponent(query)}&limit=${limit}` +
            (captionedOnly ? "" : "&captioned=any"),
        );
        const body = await readJson<{ results: VideoResult[] }>(response);
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
    async (videoId: string): Promise<Source> => {
      const existing = readLive().sources.find((source) => source.videoId === videoId);
      if (existing) return existing;

      const video = await readJson<VideoResult>(
        await fetch(`/api/youtube/video?videoId=${encodeURIComponent(videoId)}`),
      );
      const state = await apply({
        type: "add_source",
        source: { ...video, addedBy: identity.label },
      });
      return (
        state.sources.find((source) => source.videoId === videoId) ?? {
          ...video,
          addedAt: Date.now(),
          addedBy: identity.label,
        }
      );
    },
    [apply, identity.label, readLive],
  );

  const loadTranscript = useCallback(
    async (videoId: string): Promise<TranscriptSegment[]> => {
      const cached = readLive().sources.find((s) => s.videoId === videoId)?.transcript;
      if (cached) return cached;

      try {
        const body = await readJson<{ segments: TranscriptSegment[] }>(
          await fetch(`/api/youtube/transcript?videoId=${encodeURIComponent(videoId)}`),
        );
        await apply({ type: "set_transcript", videoId, segments: body.segments });
        return body.segments;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transcript failed.";
        await apply({ type: "set_transcript_error", videoId, message });
        throw error;
      }
    },
    [apply, readLive],
  );

  /** Pasting a video URL means "work with that video", not "search for this string". */
  const searchOrCollect = useCallback(
    async (
      input: string,
      options: { limit?: number; captionedOnly?: boolean } = {},
    ): Promise<
      { kind: "collected"; source: Source } | { kind: "searched"; results: VideoResult[] }
    > => {
      const videoId = extractVideoId(input);
      if (videoId) {
        setBusy(true);
        try {
          return { kind: "collected", source: await collectSource(videoId) };
        } finally {
          setBusy(false);
        }
      }
      return { kind: "searched", results: await runSearch(input, options) };
    },
    [collectSource, runSearch, setBusy],
  );

  return { runSearch, collectSource, loadTranscript, searchOrCollect };
}
