"use client";

import { useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-store";

/**
 * Dispatching the research team.
 *
 * The run takes a minute or two and makes several model calls, so the request is
 * deliberately not awaited: the team writes into the shared workspace as it goes
 * and the page's polling shows it arriving. Blocking the caller would just hide
 * the most interesting part.
 */
export function useResearchTeam() {
  const { workspaceId, apply, identity } = useWorkspace();

  const dispatchTeam = useCallback(
    async (topic: string) => {
      // Set the topic immediately so the researcher sees something happened.
      await apply({ type: "set_topic", topic });
      await apply({
        type: "add_note",
        note: {
          authorId: identity.id,
          authorLabel: identity.label,
          authorKind: identity.kind,
          text: `Put the research team on "${topic}".`,
        },
      });

      void fetch(`/api/workspace/${workspaceId}/team`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic }),
      }).catch(() => {});

      return `Research team dispatched on "${topic}". Scout, Reader, Critic and Synthesist will join and file into this workspace over the next minute or two — call read_workspace again shortly to see what they found.`;
    },
    [apply, identity, workspaceId],
  );

  return { dispatchTeam };
}
