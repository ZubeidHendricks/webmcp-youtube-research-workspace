import { ACCOUNT, dataset, reportingWindow, type DayRow, type Entity, type Metrics } from "./data";

/**
 * Fixed query shapes over the account.
 *
 * Adapted from the tool surface in ZubeidHendricks/dispatch: there is deliberately
 * no free-form query tool. Every shape an agent can ask for is defined here, so a
 * confused or steered agent has no vocabulary for anything else.
 */

export interface Window {
  since: string;
  until: string;
}

function empty(): Metrics {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    cpm: null,
    ctr: null,
    cvr: null,
    cpa: null,
    roas: null,
    frequency: null,
  };
}

function derive(totals: Metrics, frequency: number | null): Metrics {
  return {
    ...totals,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : null,
    cvr: totals.clicks > 0 ? totals.conversions / totals.clicks : null,
    cpa: totals.conversions > 0 ? totals.spend / totals.conversions : null,
    roas: totals.spend > 0 ? totals.revenue / totals.spend : null,
    frequency,
  };
}

function accumulate(rows: DayRow[]): Metrics {
  return rows.reduce((totals, row) => {
    totals.spend += row.spend;
    totals.impressions += row.impressions;
    totals.clicks += row.clicks;
    totals.conversions += row.conversions;
    totals.revenue += row.revenue;
    return totals;
  }, empty());
}

export function defaultWindow(): Window {
  const { since, until } = reportingWindow();
  return { since, until };
}

function inWindow(row: DayRow, window: Window) {
  return row.date >= window.since && row.date <= window.until;
}

/** Ad sets belonging to a campaign, or the ad set itself. */
function descendantIds(entityId: string, entities: Entity[]): string[] {
  const entity = entities.find((e) => e.id === entityId);
  if (!entity) return [];
  if (entity.level === "adset") return [entity.id];
  return entities.filter((e) => e.parentId === entity.id).map((e) => e.id);
}

export function accountSummary(window: Window = defaultWindow()) {
  const { rows, frequency } = dataset();
  const scoped = rows.filter((row) => inWindow(row, window));
  const avgFrequency =
    frequency.size > 0
      ? [...frequency.values()].reduce((a, b) => a + b, 0) / frequency.size
      : null;

  return {
    account: ACCOUNT,
    window,
    metrics: derive(accumulate(scoped), avgFrequency),
  };
}

export interface Breakdown {
  id: string;
  name: string;
  level: "campaign" | "adset";
  metrics: Metrics;
}

export function breakdown(
  level: "campaign" | "adset",
  window: Window = defaultWindow(),
  parentId?: string,
): Breakdown[] {
  const { entities, rows, frequency } = dataset();
  const scoped = rows.filter((row) => inWindow(row, window));

  const targets = entities.filter((entity) => {
    if (entity.level !== level) return false;
    if (!parentId) return true;
    return entity.parentId === parentId || entity.id === parentId;
  });

  return targets
    .map((entity) => {
      const ids = new Set(descendantIds(entity.id, entities));
      const entityRows = scoped.filter((row) => ids.has(row.entityId));
      const freqValues = [...ids].map((id) => frequency.get(id)).filter((v): v is number => v != null);
      const avg = freqValues.length
        ? freqValues.reduce((a, b) => a + b, 0) / freqValues.length
        : null;
      return {
        id: entity.id,
        name: entity.name,
        level: entity.level as "campaign" | "adset",
        metrics: derive(accumulate(entityRows), avg),
      };
    })
    .sort((a, b) => b.metrics.spend - a.metrics.spend);
}

/** Daily series for one entity, or the whole account when omitted. */
export function timeseries(entityId?: string, window: Window = defaultWindow()) {
  const { entities, rows, frequency } = dataset();
  const ids = entityId ? new Set(descendantIds(entityId, entities)) : null;
  const scoped = rows.filter((row) => inWindow(row, window) && (!ids || ids.has(row.entityId)));

  const byDate = new Map<string, DayRow[]>();
  for (const row of scoped) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  const freq = entityId ? (frequency.get(entityId) ?? null) : null;

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) => ({ date, metrics: derive(accumulate(dayRows), freq) }));
}

export function findEntity(query: string): Entity | undefined {
  const { entities } = dataset();
  const needle = query.trim().toLowerCase();
  return (
    entities.find((entity) => entity.id === query.trim()) ??
    entities.find((entity) => entity.name.toLowerCase() === needle) ??
    entities.find((entity) => entity.name.toLowerCase().includes(needle))
  );
}

export function formatMetric(metric: string, value: number | null, currency = "USD"): string {
  if (value == null) return "—";
  switch (metric) {
    case "spend":
    case "revenue":
    case "cpa":
    case "cpm":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    case "ctr":
    case "cvr":
      return `${(value * 100).toFixed(2)}%`;
    case "roas":
      return `${value.toFixed(2)}×`;
    case "frequency":
      return value.toFixed(2);
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}
