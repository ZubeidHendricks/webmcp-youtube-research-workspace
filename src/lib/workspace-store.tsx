"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

  const addSource = useCallback((video: VideoResult) => {
    const source: Source = { ...video, addedAt: Date.now() };
    setSources((current) =>
      current.some((item) => item.videoId === video.videoId)
        ? current
        : [...current, source],
    );
    return source;
  }, []);

  const removeSource = useCallback((videoId: string) => {
    let removed: Source | undefined;
    setSources((current) => {
      removed = current.find((item) => item.videoId === videoId);
      return current.filter((item) => item.videoId !== videoId);
    });
    return removed;
  }, []);

  const setTranscript = useCallback((videoId: string, segments: TranscriptSegment[]) => {
    setSources((current) =>
      current.map((item) =>
        item.videoId === videoId
          ? { ...item, transcript: segments, transcriptError: undefined }
          : item,
      ),
    );
  }, []);

  const setTranscriptError = useCallback((videoId: string, message: string) => {
    setSources((current) =>
      current.map((item) =>
        item.videoId === videoId ? { ...item, transcriptError: message } : item,
      ),
    );
  }, []);

  const addNote = useCallback((note: Omit<Note, "id" | "createdAt">) => {
    const created: Note = { ...note, id: crypto.randomUUID(), createdAt: Date.now() };
    setNotes((current) => [...current, created]);
    return created;
  }, []);

  const removeNote = useCallback((id: string) => {
    let removed: Note | undefined;
    setNotes((current) => {
      removed = current.find((note) => note.id === id);
      return current.filter((note) => note.id !== id);
    });
    return removed;
  }, []);

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
      findSource: (query) => {
        const needle = query.trim().toLowerCase();
        return (
          sources.find((source) => source.videoId === query.trim()) ??
          sources.find((source) => source.title.toLowerCase() === needle) ??
          sources.find((source) => source.title.toLowerCase().includes(needle))
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
