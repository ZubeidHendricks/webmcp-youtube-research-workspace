import type { PaperResult, Passage } from "@/lib/papers/types";

/** Who contributed something — a person, or a named agent working alongside them. */
export interface Participant {
  id: string;
  label: string;
  kind: "human" | "agent";
  joinedAt: number;
  lastSeen: number;
}

export interface Source extends PaperResult {
  addedAt: number;
  addedBy: string;
  /** Section-tagged paragraphs, once the full text has been read. */
  passages?: Passage[];
  fullTextError?: string;
}

/**
 * A note is either freeform, or anchored to a passage of a paper — the anchored
 * kind is what makes the workspace worth building together: the agent drops a
 * citation the researcher can click straight through to the sentence.
 */
export interface Note {
  id: string;
  text: string;
  createdAt: number;
  authorId: string;
  authorLabel: string;
  authorKind: "human" | "agent";
  anchor?: { sourceId: string; section: string; quote: string };
}

/** The part of the workspace shared across every browser and agent in it. */
export interface WorkspaceState {
  id: string;
  topic: string;
  sources: Source[];
  notes: Note[];
  participants: Participant[];
  version: number;
  updatedAt: number;
}

export type WorkspaceOp =
  | { type: "join"; participant: Omit<Participant, "joinedAt" | "lastSeen"> }
  | { type: "set_topic"; topic: string }
  | { type: "add_source"; source: Omit<Source, "addedAt"> }
  | { type: "remove_source"; sourceId: string }
  | { type: "set_passages"; sourceId: string; passages: Passage[] }
  | { type: "set_fulltext_error"; sourceId: string; message: string }
  | { type: "add_note"; note: Omit<Note, "id" | "createdAt"> }
  | { type: "remove_note"; noteId: string };

/**
 * A participant that hasn't checked in recently has stopped working here.
 *
 * They stay listed rather than disappearing: a team agent that finished its run
 * still did the work, and the researcher needs to see who contributed what.
 */
export const PRESENCE_TIMEOUT_MS = 90_000;

export function isActive(participant: Participant, now = Date.now()): boolean {
  return now - participant.lastSeen < PRESENCE_TIMEOUT_MS;
}

export function emptyWorkspace(id: string): WorkspaceState {
  return {
    id,
    topic: "",
    sources: [],
    notes: [],
    participants: [],
    version: 0,
    updatedAt: Date.now(),
  };
}
