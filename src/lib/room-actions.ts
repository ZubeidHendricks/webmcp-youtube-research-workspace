"use client";

import { useCallback } from "react";
import type { Metrics } from "@/lib/account/data";
import type { Breakdown, Window } from "@/lib/account/query";

export interface MetricCheck {
  entityId: string;
  entityName: string;
  level: "account" | "campaign" | "adset";
  metric: string;
  window: Window;
  value: number | null;
  display: string;
}

export interface AccountSummary {
  account: { id: string; name: string; currency: string; timezone: string };
  window: Window;
  metrics: Metrics;
}

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
  return body;
}

/**
 * Reads of the account, shared by the UI and the agent tools.
 *
 * Both go through the same endpoint, so a number an agent cites is the number on
 * the buyer's screen — not a second implementation that can quietly drift.
 */
export function useAccount() {
  const summary = useCallback(() => get<AccountSummary>("/api/account?view=summary"), []);

  const campaigns = useCallback(
    () => get<{ window: Window; rows: Breakdown[] }>("/api/account?view=campaigns"),
    [],
  );

  const adsets = useCallback(
    (parentId?: string) =>
      get<{ window: Window; rows: Breakdown[] }>(
        `/api/account?view=adsets${parentId ? `&parentId=${encodeURIComponent(parentId)}` : ""}`,
      ),
    [],
  );

  /** What is this number, really? Used to check a citation before it is filed. */
  const checkMetric = useCallback(
    (metric: string, entityId?: string) =>
      get<MetricCheck>(
        `/api/account?view=metric&metric=${encodeURIComponent(metric)}` +
          (entityId ? `&entityId=${encodeURIComponent(entityId)}` : ""),
      ),
    [],
  );

  return { summary, campaigns, adsets, checkMetric };
}
