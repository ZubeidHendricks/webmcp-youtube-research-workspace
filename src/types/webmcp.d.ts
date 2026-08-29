/**
 * Ambient types for the WebMCP browser API (`document.modelContext`).
 *
 * The spec is still evolving — see
 * https://github.com/webmachinelearning/webmcp and
 * https://developer.chrome.com/docs/ai/webmcp/imperative-api
 * Keep this file in sync with the shipped Chrome surface.
 */

/** JSON Schema subset used to describe a tool's parameters. */
export interface WebMcpInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface WebMcpToolDescriptor<Input = Record<string, unknown>> {
  /** Stable, snake_case identifier the agent calls. */
  name: string;
  /** Plain-language description of what the tool does and when to use it. */
  description: string;
  inputSchema: WebMcpInputSchema;
  /** Runs in the page. Return a string (or JSON-serializable value) for the agent. */
  execute: (
    input: Input,
    context: { signal: AbortSignal },
  ) => Promise<string | unknown> | string | unknown;
}

export interface WebMcpRegisterOptions {
  /** Aborting this signal unregisters the tool. */
  signal?: AbortSignal;
}

export interface WebMcpModelContext {
  registerTool: (
    tool: WebMcpToolDescriptor,
    options?: WebMcpRegisterOptions,
  ) => Promise<void>;
  getTools?: () => Promise<WebMcpToolDescriptor[]>;
  executeTool?: (
    tool: WebMcpToolDescriptor,
    argsJson: string,
  ) => Promise<unknown>;
}

declare global {
  interface Document {
    modelContext?: WebMcpModelContext;
  }
}

export {};
