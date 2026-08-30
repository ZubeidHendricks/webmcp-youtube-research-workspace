"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { VideoResult } from "@/lib/youtube/types";
import {
  emptyWorkspace,
  type Note,
  type Participant,
  type Source,
  type WorkspaceOp,
  type WorkspaceState,
} from "@/lib/workspace/types";

export type { Note, Participant, Source };

/** What the viewer is looking at. Per-browser, never shared. */
export type Focus =
  | { kind: "source"; videoId: string }
  | { kind: "notes" }
  | { kind: "results" };

export interface Identity {
  id: string;
  label: string;
  kind: "human" | "agent";
}

interface WorkspaceValue {
  shared: WorkspaceState;
  /** Readable synchronously right after a mutation — tools chain calls faster than React renders. */
  readLive: () => WorkspaceState;
  identity: Identity;
  setIdentity: (identity: Identity) => Promise<void>;
  results: VideoResult[];
  setResults: (results: VideoResult[]) => void;
  focus: Focus;
  setFocus: (focus: Focus) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  offline: string | null;
  apply: (op: WorkspaceOp) => Promise<WorkspaceState>;
  findSource: (query: string) => Source | undefined;
}

/**
 * Identity lives outside React so it can be read during render.
 *
 * It is per-browser and persisted, so a reload keeps your notes attributed to you
 * and an agent that renamed itself stays renamed.
 */
const identityCache = new Map<string, Identity>();
const identityListeners = new Set<() => void>();
const SERVER_IDENTITY: Identity = { id: "pending", label: "You", kind: "human" };

function identityKey(workspaceId: string) {
  return `webmcp-identity:${workspaceId}`;
}

function loadIdentity(workspaceId: string): Identity {
  const cached = identityCache.get(workspaceId);
  if (cached) return cached;

  let identity: Identity | null = null;
  try {
    const raw = window.localStorage.getItem(identityKey(workspaceId));
    if (raw) identity = JSON.parse(raw) as Identity;
  } catch {
    // private mode or blocked storage
  }
  const resolved = identity ?? { id: crypto.randomUUID(), label: "You", kind: "human" };
  identityCache.set(workspaceId, resolved);
  try {
    window.localStorage.setItem(identityKey(workspaceId), JSON.stringify(resolved));
  } catch {
    // non-fatal
  }
  return resolved;
}

function storeIdentity(workspaceId: string, identity: Identity) {
  identityCache.set(workspaceId, identity);
  try {
    window.localStorage.setItem(identityKey(workspaceId), JSON.stringify(identity));
  } catch {
    // non-fatal
  }
  identityListeners.forEach((listener) => listener());
}

function subscribeIdentity(listener: () => void) {
  identityListeners.add(listener);
  return () => identityListeners.delete(listener);
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const POLL_MS = 2000;

export function WorkspaceProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const [shared, setShared] = useState<WorkspaceState>(() => emptyWorkspace(workspaceId));
  const [results, setResults] = useState<VideoResult[]>([]);
  const [focus, setFocus] = useState<Focus>({ kind: "results" });
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState<string | null>(null);
  const identity = useSyncExternalStore(
    subscribeIdentity,
    () => loadIdentity(workspaceId),
    () => SERVER_IDENTITY,
  );

  const sharedRef = useRef(shared);

  const commit = useCallback((next: WorkspaceState) => {
    // Ignore stale responses that lost a race with a newer poll or write.
    if (next.version < sharedRef.current.version) return;
    sharedRef.current = next;
    setShared(next);
  }, []);

  const apply = useCallback(
    async (op: WorkspaceOp) => {
      const response = await fetch(`/api/workspace/${workspaceId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op),
      });
      const body = (await response.json()) as WorkspaceState & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not apply the change.");
      commit(body);
      setOffline(null);
      return body;
    },
    [workspaceId, commit],
  );

  // Announce this browser to the workspace once.
  useEffect(() => {
    void fetch(`/api/workspace/${workspaceId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "join",
        participant: loadIdentity(workspaceId),
      } satisfies WorkspaceOp),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((state: WorkspaceState | null) => state && commit(state))
      .catch(() => setOffline("Working offline — changes are not being shared."));
  }, [workspaceId, commit]);

  // Poll for what everyone else is doing.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const response = await fetch(`/api/workspace/${workspaceId}`, { cache: "no-store" });
        if (response.ok && !cancelled) {
          commit((await response.json()) as WorkspaceState);
          setOffline(null);
        }
      } catch {
        if (!cancelled) setOffline("Reconnecting…");
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };

    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workspaceId, commit]);

  const setIdentity = useCallback(
    async (next: Identity) => {
      storeIdentity(workspaceId, next);
      await apply({ type: "join", participant: next });
    },
    [apply, workspaceId],
  );

  const value = useMemo<WorkspaceValue>(
    () => ({
      shared,
      readLive: () => sharedRef.current,
      identity,
      setIdentity,
      results,
      setResults,
      focus,
      setFocus,
      busy,
      setBusy,
      offline,
      apply,
      findSource: (query) => {
        const needle = query.trim().toLowerCase();
        const live = sharedRef.current.sources;
        return (
          live.find((source) => source.videoId === query.trim()) ??
          live.find((source) => source.title.toLowerCase() === needle) ??
          live.find((source) => source.title.toLowerCase().includes(needle))
        );
      },
    }),
    [shared, identity, setIdentity, results, focus, busy, offline, apply],
  );

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return value;
}
