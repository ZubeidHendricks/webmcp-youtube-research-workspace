export type WebMcpSupport = "unknown" | "supported" | "simulated" | "unsupported";

/**
 * WebMCP is only present in agent-capable browsers (ChatGPT's in-app browser,
 * Chrome 149+ with the WebMCP flag). Everything else renders the plain UI.
 */
export function detectWebMcpSupport(): WebMcpSupport {
  if (typeof document === "undefined") return "unknown";
  if (typeof document.modelContext?.registerTool !== "function") return "unsupported";
  return (document.modelContext as { __simulated?: boolean }).__simulated
    ? "simulated"
    : "supported";
}
