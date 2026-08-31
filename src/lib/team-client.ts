"use client";

import { useCallback } from "react";
import { useRoom } from "@/lib/room-store";

/**
 * Dispatching the analyst team.
 *
 * The run makes several model calls, so the request is deliberately not awaited:
 * the team files into the room as it goes and the page's polling shows the memo
 * assembling. Blocking the caller would hide the most interesting part.
 */
export function useAnalystTeam() {
  const { roomId } = useRoom();

  return useCallback(async () => {
    void fetch(`/api/room/${roomId}/team`, { method: "POST" }).catch(() => {});
    return "Analyst team dispatched. Analyst, Skeptic and Strategist will join and work through the account over the next minute or two — call read_memo again shortly to see what they filed.";
  }, [roomId]);
}
