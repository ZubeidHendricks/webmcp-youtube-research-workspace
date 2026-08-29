export type WebMcpSupport = "unknown" | "supported" | "unsupported";

/**
 * WebMCP is only present in agent-capable browsers (ChatGPT's in-app browser,
 * Chrome 149+ with the WebMCP flag). Everything else renders the plain UI.
 */
export function detectWebMcpSupport(): WebMcpSupport {
  if (typeof document === "undefined") return "unknown";
  return typeof document.modelContext?.registerTool === "function"
    ? "supported"
    : "unsupported";
}
