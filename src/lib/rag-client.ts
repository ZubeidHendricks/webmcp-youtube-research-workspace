"use client";

import { useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-store";

export interface AskAnswer {
  answer: string;
  citations: { sourceId: string; title: string; section: string; quote: string }[];
  passagesConsidered: number;
}

/**
 * Question answering over the papers collected in this workspace.
 *
 * Indexing is fire-and-forget: it happens whenever a paper's full text arrives,
 * so asking a question never waits on an explicit "index this" step.
 */
export function useSourceQnA() {
  const { workspaceId, apply, identity } = useWorkspace();

  const indexSource = useCallback(
    (sourceId: string) => {
      void fetch(`/api/workspace/${workspaceId}/index-source`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId }),
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
              sourceId: citation.sourceId,
              section: citation.section,
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
