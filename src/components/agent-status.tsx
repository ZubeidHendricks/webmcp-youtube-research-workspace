"use client";

import { useSyncExternalStore } from "react";
import { detectWebMcpSupport } from "@/lib/webmcp/support";

/** WebMCP availability is fixed for the page's lifetime, so nothing to subscribe to. */
const subscribe = () => () => {};

/** Tells the human whether an agent can currently drive this page. */
export function AgentStatus() {
  // Renders "unknown" (nothing) on the server, then the real value after hydration.
  const support = useSyncExternalStore(
    subscribe,
    detectWebMcpSupport,
    () => "unknown" as const,
  );

  if (support === "unknown") return null;

  const supported = support === "supported";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
        supported
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
          : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      }`}
    >
      <span
        aria-hidden
        className={`mt-1.5 size-2 shrink-0 rounded-full ${
          supported ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      <p>
        {supported ? (
          <>
            <strong className="font-semibold">Agent tools active.</strong> This page has
            registered its
            research tools with the browser — ask your agent to find sources, read
            transcripts, and file citations.
          </>
        ) : (
          <>
            <strong className="font-semibold">No agent detected.</strong> The workspace works
            normally here. To try the agent tools, open it in ChatGPT&rsquo;s browser or in
            Chrome 149+ with the WebMCP flag enabled.
          </>
        )}
      </p>
    </div>
  );
}
