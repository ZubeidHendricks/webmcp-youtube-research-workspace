"use client";

import { useSyncExternalStore } from "react";
import { detectWebMcpSupport, type WebMcpSupport } from "./support";

/**
 * Tracks whether an agent can drive this page.
 *
 * `document.modelContext` is not guaranteed to exist by the time React
 * hydrates — an agent browser may install it a moment later — so a one-shot
 * read at mount can miss it permanently, leaving the page claiming no agent is
 * present while the tools sit unregistered. This polls until it shows up and
 * tells subscribers, so registration and the banner both catch up.
 */

const POLL_MS = 200;
const GIVE_UP_MS = 30_000;

const listeners = new Set<() => void>();
let snapshot: WebMcpSupport = "unknown";
let read = false;
let deadline = 0;
let timer: ReturnType<typeof setInterval> | null = null;

const settled = (value: WebMcpSupport) => value === "supported" || value === "simulated";

const stopPolling = () => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
};

const publish = () => {
  const next = detectWebMcpSupport();
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
};

/**
 * Polling is paused when nothing is listening and resumed when something is —
 * React unmounts and remounts subscribers (StrictMode does it on every mount),
 * so this must survive the listener set emptying and refilling.
 */
const ensurePolling = () => {
  if (typeof document === "undefined") return;

  if (!read) {
    read = true;
    snapshot = detectWebMcpSupport();
    deadline = Date.now() + GIVE_UP_MS;
  }

  if (timer !== null || settled(snapshot) || Date.now() > deadline) return;

  timer = setInterval(() => {
    publish();
    if (settled(snapshot) || Date.now() > deadline) stopPolling();
  }, POLL_MS);
};

const subscribe = (listener: () => void) => {
  ensurePolling();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopPolling();
  };
};

// Before the first read, go straight to the document — the value is a string,
// so returning a fresh read cannot loop React.
const getSnapshot = () => (read ? snapshot : detectWebMcpSupport());

const getServerSnapshot = () => "unknown" as const;

export function useWebMcpSupport(): WebMcpSupport {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
