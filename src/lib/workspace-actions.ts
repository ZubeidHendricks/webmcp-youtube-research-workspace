"use client";

import { useCallback } from "react";
import { useWorkspace, type Source } from "@/lib/workspace-store";
import type { TranscriptSegment, VideoResult } from "@/lib/youtube/types";

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
  return body;
}

/**
 * The operations the human UI and the WebMCP tools share. Keeping them in one
 * place is what makes an agent action and a click genuinely equivalent — both
 * paths hit the same fetch, the same state, the same rendering.
 */
export function useWorkspaceActions() {
  const {
    setTopic,
    setResults,
    setBusy,
    addSource,
    setTranscript,
    setTranscriptError,
    sources,
  } = useWorkspace();

  const runSearch = useCallback(
    async (query: string, limit = 8): Promise<VideoResult[]> => {
      setBusy(true);
      try {
        const response = await fetch(
          `/api/youtube/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        );
        const body = await readJson<{ results: VideoResult[] }>(response);
        setTopic(query);
        setResults(body.results);
        return body.results;
      } finally {
        setBusy(false);
      }
    },
    [setBusy, setResults, setTopic],
  );

  const collectSource = useCallback(
    async (videoId: string): Promise<Source> => {
      const existing = sources.find((source) => source.videoId === videoId);
      if (existing) return existing;

      const response = await fetch(
        `/api/youtube/video?videoId=${encodeURIComponent(videoId)}`,
      );
      const video = await readJson<VideoResult>(response);
      return addSource(video);
    },
    [addSource, sources],
  );

  const loadTranscript = useCallback(
    async (videoId: string): Promise<TranscriptSegment[]> => {
      const cached = sources.find((source) => source.videoId === videoId)?.transcript;
      if (cached) return cached;

      try {
        const response = await fetch(
          `/api/youtube/transcript?videoId=${encodeURIComponent(videoId)}`,
        );
        const body = await readJson<{ segments: TranscriptSegment[] }>(response);
        setTranscript(videoId, body.segments);
        return body.segments;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transcript failed.";
        setTranscriptError(videoId, message);
        throw error;
      }
    },
    [sources, setTranscript, setTranscriptError],
  );

  return { runSearch, collectSource, loadTranscript };
}
