"use client";

import { useEffect, useRef } from "react";
import { useWebMcpSupport } from "./availability";
import type { WebMcpInputSchema } from "@/types/webmcp";

export interface UseWebMcpToolOptions<Input> {
  name: string;
  description: string;
  inputSchema: WebMcpInputSchema;
  execute: (
    input: Input,
    context: { signal: AbortSignal },
  ) => Promise<string> | string;
  /** Skip registration (e.g. tool is only valid on a certain view). */
  enabled?: boolean;
}

/**
 * Registers one WebMCP tool for the lifetime of the component.
 *
 * `execute` is kept in a ref so the tool always sees fresh state without
 * re-registering on every render — re-registering churns the agent's tool list.
 *
 * Registration is keyed on WebMCP availability rather than done once on mount:
 * an agent browser may install `document.modelContext` after hydration, and a
 * single early check would leave the tool unregistered for the page's life.
 */
export function useWebMcpTool<Input = Record<string, unknown>>({
  name,
  description,
  inputSchema,
  execute,
  enabled = true,
}: UseWebMcpToolOptions<Input>) {
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  });

  const schemaKey = JSON.stringify(inputSchema);
  const support = useWebMcpSupport();

  useEffect(() => {
    if (!enabled) return;
    if (typeof document.modelContext?.registerTool !== "function") return;

    const controller = new AbortController();

    void document.modelContext
      .registerTool(
        {
          name,
          description,
          inputSchema: JSON.parse(schemaKey) as WebMcpInputSchema,
          execute: async (input, context) =>
            executeRef.current(input as Input, context),
        },
        { signal: controller.signal },
      )
      .catch((error: unknown) => {
        console.error(`[webmcp] failed to register tool "${name}"`, error);
      });

    return () => controller.abort();
  }, [name, description, schemaKey, enabled, support]);
}
