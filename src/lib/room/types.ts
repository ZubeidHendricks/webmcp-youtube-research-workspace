import type { Window } from "@/lib/account/query";

/**
 * The closed finding set, from ZubeidHendricks/dispatch.
 *
 * Keeping it closed is what makes memos comparable week over week — an
 * open-ended "insight" field drifts in wording every run and makes the diff
 * between two weeks meaningless.
 */
export const FINDING_KINDS = [
  "cruising",
  "turbulence",
  "rip_current",
  "scale",
  "consolidate",
  "fatigue",
] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

export const KIND_GUIDANCE: Record<FindingKind, string> = {
  cruising:
    "Stable and performing: steady cost, no action needed. Say so explicitly — 'leave this alone' is a finding.",
  turbulence:
    "In or near learning phase, or destabilised by recent changes: low volume, erratic cost, budget moved too fast.",
  rip_current:
    "Rising CPM and falling conversion rate together, usually alongside too many concurrent tests. The response is consolidation, never more budget.",
  scale: "Sustained efficiency with headroom. Name the specific increment, not just 'scale it'.",
  consolidate: "Spend fragmented across too many ad sets competing in the same auction.",
  fatigue: "Frequency climbing while CTR or conversion rate decays on the same creative.",
};

export const KIND_LABEL: Record<FindingKind, string> = {
  cruising: "Cruising",
  turbulence: "Turbulence",
  rip_current: "Rip current",
  scale: "Scale",
  consolidate: "Consolidate",
  fatigue: "Fatigue",
};

/** Every claim points at a number someone can go and check. */
export interface Citation {
  level: "account" | "campaign" | "adset";
  entityId: string;
  entityName: string;
  metric: string;
  window: Window;
  value: string;
}

export type FindingStatus = "open" | "accepted" | "dismissed";

export interface Finding {
  id: string;
  kind: FindingKind;
  /** 1 = worth knowing, 2 = act this week, 3 = act today. */
  severity: 1 | 2 | 3;
  headline: string;
  rationale: string;
  citation: Citation;
  status: FindingStatus;
  /** Why a person accepted or dismissed it. */
  verdictNote?: string;
  authorId: string;
  authorLabel: string;
  authorKind: "human" | "agent";
  createdAt: number;
}

export interface Participant {
  id: string;
  label: string;
  kind: "human" | "agent";
  joinedAt: number;
  lastSeen: number;
}

export interface RoomState {
  id: string;
  findings: Finding[];
  participants: Participant[];
  version: number;
  updatedAt: number;
}

export type RoomOp =
  | { type: "join"; participant: Omit<Participant, "joinedAt" | "lastSeen"> }
  | { type: "file_finding"; finding: Omit<Finding, "id" | "createdAt" | "status"> }
  | { type: "set_status"; findingId: string; status: FindingStatus; verdictNote?: string }
  | { type: "remove_finding"; findingId: string };

export const PRESENCE_TIMEOUT_MS = 90_000;

export function isActive(participant: Participant, now = Date.now()): boolean {
  return now - participant.lastSeen < PRESENCE_TIMEOUT_MS;
}

export function emptyRoom(id: string): RoomState {
  return { id, findings: [], participants: [], version: 0, updatedAt: Date.now() };
}

/** Highest severity and most actionable first — the order a memo is read in. */
export function orderFindings(findings: Finding[]): Finding[] {
  const statusRank: Record<FindingStatus, number> = { open: 0, accepted: 1, dismissed: 2 };
  return [...findings].sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      b.severity - a.severity ||
      a.createdAt - b.createdAt,
  );
}
