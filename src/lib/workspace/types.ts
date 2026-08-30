import type { TranscriptSegment, VideoResult } from "@/lib/youtube/types";

/** Who contributed something — a person, or a named agent working alongside them. */
export interface Participant {
  id: string;
  label: string;
  kind: "human" | "agent";
  joinedAt: number;
  lastSeen: number;
}

export interface Source extends VideoResult {
  addedAt: number;
  addedBy: string;
  transcript?: TranscriptSegment[];
  transcriptError?: string;
  /** Set when an agent supplied the transcript itself rather than the server fetching it. */
  transcriptFrom?: string;
}

export interface Note {
  id: string;
  text: string;
  createdAt: number;
  authorId: string;
  authorLabel: string;
  authorKind: "human" | "agent";
  anchor?: { videoId: string; seconds: number; timestamp: string; quote: string };
}

/** The part of the workspace that is shared across every browser and agent in it. */
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
  | { type: "remove_source"; videoId: string }
  | { type: "set_transcript"; videoId: string; segments: TranscriptSegment[]; from?: string }
  | { type: "set_transcript_error"; videoId: string; message: string }
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

/** Applies one operation. Pure, so the server and any future optimistic client agree. */
export function applyOp(state: WorkspaceState, op: WorkspaceOp): WorkspaceState {
  const next: WorkspaceState = {
    ...state,
    version: state.version + 1,
    updatedAt: Date.now(),
  };

  switch (op.type) {
    case "join": {
      const existing = state.participants.find((p) => p.id === op.participant.id);
      next.participants = existing
        ? state.participants.map((p) =>
            p.id === op.participant.id
              ? { ...p, label: op.participant.label, kind: op.participant.kind, lastSeen: Date.now() }
              : p,
          )
        : [
            ...state.participants,
            { ...op.participant, joinedAt: Date.now(), lastSeen: Date.now() },
          ];
      return next;
    }
    case "set_topic":
      next.topic = op.topic;
      return next;
    case "add_source":
      if (state.sources.some((s) => s.videoId === op.source.videoId)) return state;
      next.sources = [...state.sources, { ...op.source, addedAt: Date.now() }];
      return next;
    case "remove_source":
      if (!state.sources.some((s) => s.videoId === op.videoId)) return state;
      next.sources = state.sources.filter((s) => s.videoId !== op.videoId);
      return next;
    case "set_transcript":
      next.sources = state.sources.map((s) =>
        s.videoId === op.videoId
          ? { ...s, transcript: op.segments, transcriptError: undefined, transcriptFrom: op.from }
          : s,
      );
      return next;
    case "set_transcript_error":
      next.sources = state.sources.map((s) =>
        s.videoId === op.videoId ? { ...s, transcriptError: op.message } : s,
      );
      return next;
    case "add_note":
      next.notes = [
        ...state.notes,
        { ...op.note, id: crypto.randomUUID(), createdAt: Date.now() },
      ];
      return next;
    case "remove_note":
      if (!state.notes.some((n) => n.id === op.noteId)) return state;
      next.notes = state.notes.filter((n) => n.id !== op.noteId);
      return next;
  }
}
