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

import {
  emptyRoom,
  type Finding,
  type Participant,
  type RoomOp,
  type RoomState,
} from "@/lib/room/types";

export type { Finding, Participant };

/** What the viewer is looking at. Per-browser, never shared. */
export type Focus =
  | { kind: "memo" }
  | { kind: "campaigns" }
  | { kind: "entity"; entityId: string };

export interface Identity {
  id: string;
  label: string;
  kind: "human" | "agent";
}

interface RoomValue {
  roomId: string;
  shared: RoomState;
  /** Readable synchronously right after a mutation — tools chain calls faster than React renders. */
  readLive: () => RoomState;
  identity: Identity;
  setIdentity: (identity: Identity) => Promise<void>;
  focus: Focus;
  setFocus: (focus: Focus) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  offline: string | null;
  apply: (op: RoomOp) => Promise<RoomState>;
}

/**
 * Identity lives outside React so it can be read during render.
 *
 * Stored per browser and workspace, not per tab: sessionStorage gave every tab
 * and every reload a fresh identity, so the participant list filled up with
 * repeated "You" entries that never went away. One browser is one participant;
 * an agent that wants its own name says so with `join_workspace`.
 */
const identityCache = new Map<string, Identity>();
const identityListeners = new Set<() => void>();
const SERVER_IDENTITY: Identity = { id: "pending", label: "You", kind: "human" };

function identityKey(roomId: string) {
  return `dispatch-identity:${roomId}`;
}

function loadIdentity(roomId: string): Identity {
  const cached = identityCache.get(roomId);
  if (cached) return cached;

  let identity: Identity | null = null;
  try {
    const raw = window.localStorage.getItem(identityKey(roomId));
    if (raw) identity = JSON.parse(raw) as Identity;
  } catch {
    // private mode or blocked storage
  }
  const resolved = identity ?? { id: crypto.randomUUID(), label: "You", kind: "human" };
  identityCache.set(roomId, resolved);
  try {
    window.localStorage.setItem(identityKey(roomId), JSON.stringify(resolved));
  } catch {
    // non-fatal
  }
  return resolved;
}

function storeIdentity(roomId: string, identity: Identity) {
  identityCache.set(roomId, identity);
  try {
    window.localStorage.setItem(identityKey(roomId), JSON.stringify(identity));
  } catch {
    // non-fatal
  }
  identityListeners.forEach((listener) => listener());
}

function subscribeIdentity(listener: () => void) {
  identityListeners.add(listener);
  return () => identityListeners.delete(listener);
}

const RoomContext = createContext<RoomValue | null>(null);

const POLL_MS = 2000;
/** How often a tab re-announces itself so it isn't pruned as gone. */
const HEARTBEAT_MS = 30_000;

export function RoomProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const [shared, setShared] = useState<RoomState>(() => emptyRoom(roomId));
  const [focus, setFocus] = useState<Focus>({ kind: "memo" });
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState<string | null>(null);
  const identity = useSyncExternalStore(
    subscribeIdentity,
    () => loadIdentity(roomId),
    () => SERVER_IDENTITY,
  );

  const sharedRef = useRef(shared);

  const commit = useCallback((next: RoomState) => {
    // Ignore stale responses that lost a race with a newer poll or write.
    if (next.version < sharedRef.current.version) return;
    sharedRef.current = next;
    setShared(next);
  }, []);

  const apply = useCallback(
    async (op: RoomOp) => {
      const response = await fetch(`/api/room/${roomId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(op),
      });
      const body = (await response.json()) as RoomState & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not apply the change.");
      commit(body);
      setOffline(null);
      return body;
    },
    [roomId, commit],
  );

  // Announce this browser to the workspace once.
  useEffect(() => {
    void fetch(`/api/room/${roomId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "join",
        participant: loadIdentity(roomId),
      } satisfies RoomOp),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((state: RoomState | null) => state && commit(state))
      .catch(() => setOffline("Working offline — changes are not being shared."));
  }, [roomId, commit]);

  // Poll for what everyone else is doing, and check in so we stay listed.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let sinceHeartbeat = 0;

    const tick = async () => {
      try {
        sinceHeartbeat += POLL_MS;
        if (sinceHeartbeat >= HEARTBEAT_MS) {
          sinceHeartbeat = 0;
          void fetch(`/api/room/${roomId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              type: "join",
              participant: loadIdentity(roomId),
            } satisfies RoomOp),
          }).catch(() => {});
        }
        const response = await fetch(`/api/room/${roomId}`, { cache: "no-store" });
        if (response.ok && !cancelled) {
          commit((await response.json()) as RoomState);
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
  }, [roomId, commit]);

  const setIdentity = useCallback(
    async (next: Identity) => {
      storeIdentity(roomId, next);
      await apply({ type: "join", participant: next });
    },
    [apply, roomId],
  );

  const value = useMemo<RoomValue>(
    () => ({
      roomId,
      shared,
      readLive: () => sharedRef.current,
      identity,
      setIdentity,
      focus,
      setFocus,
      busy,
      setBusy,
      offline,
      apply,
    }),
    [roomId, shared, identity, setIdentity, focus, busy, offline, apply],
  );

  return <RoomContext value={value}>{children}</RoomContext>;
}

export function useRoom() {
  const value = useContext(RoomContext);
  if (!value) throw new Error("useRoom must be used inside <RoomProvider>");
  return value;
}
