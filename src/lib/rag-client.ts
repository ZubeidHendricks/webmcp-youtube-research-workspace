"use client";

import { useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-store";

export interface AskAnswer {
  answer: string;
  citations: { videoId: string; title: string; seconds: number; timestamp: string; quote: string }[];
  passagesConsidered: number;
}

/**
 * Question answering over the transcripts collected in this workspace.
 *
 * Indexing is fire-and-forget: it happens whenever a transcript arrives, by any
 * route — a server fetch, or an agent calling `provide_transcript` — so asking a
 * question never has to wait for an explicit "index this" step.
 */
export function useSourceQnA() {
  const { workspaceId, apply, identity } = useWorkspace();

  const indexSource = useCallback(
    (videoId: string) => {
      void fetch(`/api/workspace/${workspaceId}/index-source`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId }),
      }).catch(() => {});
    },
    [workspaceId],
  );

  const ask = useCallback(
    async (question: string): Promise<AskAnswer> => {
      const response = await fetch(`/api/workspace/${workspaceId}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = (await response.json()) as AskAnswer & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not answer.");
      return body;
    },
    [workspaceId],
  );

  /** Answers, then files the answer and its citations into the workspace. */
  const askAndRecord = useCallback(
    async (question: string): Promise<AskAnswer> => {
      const result = await ask(question);

      await apply({
        type: "add_note",
        note: {
          authorId: identity.id,
          authorLabel: identity.label,
          authorKind: identity.kind,
          text: `Q: ${question}\nA: ${result.answer}`,
        },
      });

      for (const citation of result.citations) {
        await apply({
          type: "add_note",
          note: {
            authorId: identity.id,
            authorLabel: identity.label,
            authorKind: identity.kind,
            text: `Supports: ${question}`,
            anchor: {
              videoId: citation.videoId,
              seconds: citation.seconds,
              timestamp: citation.timestamp,
              quote: citation.quote,
            },
          },
        });
      }

      return result;
    },
    [ask, apply, identity],
  );

  return { ask, askAndRecord, indexSource };
}
