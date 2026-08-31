import { NextResponse } from "next/server";
import {
  accountSummary,
  breakdown,
  defaultWindow,
  findEntity,
  formatMetric,
  timeseries,
} from "@/lib/account/query";
import { ACCOUNT } from "@/lib/account/data";
import type { Metrics } from "@/lib/account/data";

export const dynamic = "force-dynamic";

/**
 * One read endpoint with fixed shapes — the client and the agent tools both use
 * it, so a person clicking and an agent asking see identical numbers.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "summary";
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const window = since && until ? { since, until } : defaultWindow();

  switch (view) {
    case "summary":
      return NextResponse.json(accountSummary(window));
    case "campaigns":
      return NextResponse.json({ window, rows: breakdown("campaign", window) });
    case "adsets":
      return NextResponse.json({
        window,
        rows: breakdown("adset", window, searchParams.get("parentId") ?? undefined),
      });
    case "timeseries":
      return NextResponse.json({
        window,
        series: timeseries(searchParams.get("entityId") ?? undefined, window),
      });
    case "metric": {
      // Used to check a citation before it is filed: what is this number, really?
      const metric = searchParams.get("metric") ?? "";
      const entityQuery = searchParams.get("entityId");
      const entity = entityQuery ? findEntity(entityQuery) : null;

      if (entityQuery && !entity) {
        return NextResponse.json({ error: `No entity matching "${entityQuery}".` }, { status: 404 });
      }

      const metrics: Metrics = entity
        ? (breakdown(entity.level === "campaign" ? "campaign" : "adset", window, entity.id).find(
            (row) => row.id === entity.id,
          )?.metrics ?? accountSummary(window).metrics)
        : accountSummary(window).metrics;

      const value = (metrics as unknown as Record<string, number | null>)[metric];
      if (value === undefined) {
        return NextResponse.json({ error: `Unknown metric "${metric}".` }, { status: 400 });
      }

      return NextResponse.json({
        entityId: entity?.id ?? "account",
        entityName: entity?.name ?? ACCOUNT.name,
        level: entity?.level ?? "account",
        metric,
        window,
        value,
        display: formatMetric(metric, value, ACCOUNT.currency),
      });
    }

    default:
      return NextResponse.json({ error: `Unknown view "${view}".` }, { status: 400 });
  }
}
