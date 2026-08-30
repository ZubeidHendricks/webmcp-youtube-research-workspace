"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TranscriptSegment, VideoResult } from "@/lib/youtube/types";

/** A video the researcher pulled into the workspace. */
export interface Source extends VideoResult {
  addedAt: number;
  transcript?: TranscriptSegment[];
  transcriptError?: string;
}

/**
 * A note is either freeform, or anchored to a moment in a source — the anchored
 * kind is what makes the workspace worth building together: the agent can drop a
 * citation the human can click straight through to.
 */
export interface Note {
  id: string;
  text: string;
  createdAt: number;
  author: "you" | "agent";
  anchor?: { videoId: string; seconds: number; timestamp: string; quote: string };
}

export type Focus = { kind: "source"; videoId: string } | { kind: "notes" } | { kind: "results" };

interface WorkspaceValue {
  /** Current sources/notes readable synchronously after a mutation — for tools. */
  readLive: () => { sources: Source[]; notes: Note[] };
  topic: string;
  results: VideoResult[];
  sources: Source[];
  notes: Note[];
  focus: Focus;
  busy: boolean;
  setTopic: (topic: string) => void;
  setBusy: (busy: boolean) => void;
  setResults: (results: VideoResult[]) => void;
  addSource: (video: VideoResult) => Source;
  removeSource: (videoId: string) => Source | undefined;
  setTranscript: (videoId: string, segments: TranscriptSegment[]) => void;
  setTranscriptError: (videoId: string, message: string) => void;
  addNote: (note: Omit<Note, "id" | "createdAt">) => Note;
  removeNote: (id: string) => Note | undefined;
  setFocus: (focus: Focus) => void;
  findSource: (query: string) => Source | undefined;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [topic, setTopic] = useState("");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [focus, setFocus] = useState<Focus>({ kind: "results" });
  const [busy, setBusy] = useState(false);

  /**
   * Mirrors of the collections above, updated synchronously by every mutation.
   *
   * React state is not readable until the next render, but an agent can call
   * several tools in quick succession — `cite_moment` then `read_workspace`
   * would otherwise report the workspace as it looked before the citation.
   * Tools read these; rendering reads the state.
   */
  const sourcesRef = useRef(sources);
  const notesRef = useRef(notes);

  const commitSources = useCallback((next: Source[]) => {
    sourcesRef.current = next;
    setSources(next);
  }, []);

  const commitNotes = useCallback((next: Note[]) => {
    notesRef.current = next;
    setNotes(next);
  }, []);

  const addSource = useCallback(
    (video: VideoResult) => {
      const existing = sourcesRef.current.find((item) => item.videoId === video.videoId);
      if (existing) return existing;
      const source: Source = { ...video, addedAt: Date.now() };
      commitSources([...sourcesRef.current, source]);
      return source;
    },
    [commitSources],
  );

  const removeSource = useCallback(
    (videoId: string) => {
      const removed = sourcesRef.current.find((item) => item.videoId === videoId);
      if (removed) {
        commitSources(sourcesRef.current.filter((item) => item.videoId !== videoId));
      }
      return removed;
    },
    [commitSources],
  );

  const setTranscript = useCallback(
    (videoId: string, segments: TranscriptSegment[]) => {
      commitSources(
        sourcesRef.current.map((item) =>
          item.videoId === videoId
            ? { ...item, transcript: segments, transcriptError: undefined }
            : item,
        ),
      );
    },
    [commitSources],
  );

  const setTranscriptError = useCallback(
    (videoId: string, message: string) => {
      commitSources(
        sourcesRef.current.map((item) =>
          item.videoId === videoId ? { ...item, transcriptError: message } : item,
        ),
      );
    },
    [commitSources],
  );

  const addNote = useCallback(
    (note: Omit<Note, "id" | "createdAt">) => {
      const created: Note = { ...note, id: crypto.randomUUID(), createdAt: Date.now() };
      commitNotes([...notesRef.current, created]);
      return created;
    },
    [commitNotes],
  );

  const removeNote = useCallback(
    (id: string) => {
      const removed = notesRef.current.find((note) => note.id === id);
      if (removed) commitNotes(notesRef.current.filter((note) => note.id !== id));
      return removed;
    },
    [commitNotes],
  );

  const value = useMemo<WorkspaceValue>(
    () => ({
      topic,
      results,
      sources,
      notes,
      focus,
      busy,
      setTopic,
      setBusy,
      setResults,
      addSource,
      removeSource,
      setTranscript,
      setTranscriptError,
      addNote,
      removeNote,
      setFocus,
      readLive: () => ({ sources: sourcesRef.current, notes: notesRef.current }),
      findSource: (query) => {
        const needle = query.trim().toLowerCase();
        const live = sourcesRef.current;
        return (
          live.find((source) => source.videoId === query.trim()) ??
          live.find((source) => source.title.toLowerCase() === needle) ??
          live.find((source) => source.title.toLowerCase().includes(needle))
        );
      },
    }),
    [
      topic,
      results,
      sources,
      notes,
      focus,
      busy,
      addSource,
      removeSource,
      setTranscript,
      setTranscriptError,
      addNote,
      removeNote,
    ],
  );

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return value;
}
