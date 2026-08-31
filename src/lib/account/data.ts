/**
 * A deterministic demo ad account.
 *
 * Dispatch proper reads a connected Meta account; a hackathon judge cannot
 * connect one, so the room runs on a generated account instead. It is seeded, so
 * every visitor sees the same numbers and a citation filed on Monday still
 * checks out on Wednesday — which is the whole point of citing a metric.
 */

export type Level = "account" | "campaign" | "adset" | "ad";

export interface Entity {
  id: string;
  name: string;
  level: Exclude<Level, "account">;
  parentId: string | null;
  /** Creative first shipped, for fatigue reasoning. */
  launchedOn?: string;
}

export interface DayRow {
  date: string;
  entityId: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface Metrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpm: number | null;
  ctr: number | null;
  cvr: number | null;
  cpa: number | null;
  roas: number | null;
  frequency: number | null;
}

/** Small deterministic PRNG so the account is identical on every machine. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export const ACCOUNT = {
  id: "act_408815567",
  name: "Northwind Outdoor — Meta",
  currency: "USD",
  timezone: "America/New_York",
};

/**
 * Campaigns are shaped to contain the situations the finding taxonomy names, so
 * an analyst has something real to find rather than uniform noise.
 */
const CAMPAIGNS: (Entity & { shape: string; adsets: { name: string; shape: string }[] })[] = [
  {
    id: "c_evergreen_prospecting",
    name: "Evergreen Prospecting",
    level: "campaign",
    parentId: null,
    shape: "cruising",
    adsets: [
      { name: "Broad 25-54", shape: "cruising" },
      { name: "Lookalike 3% Purchasers", shape: "cruising" },
    ],
  },
  {
    id: "c_retargeting_dpa",
    name: "Retargeting — DPA",
    level: "campaign",
    parentId: null,
    shape: "fatigue",
    adsets: [
      { name: "Site visitors 14d", shape: "fatigue" },
      { name: "Cart abandoners 7d", shape: "cruising" },
    ],
  },
  {
    id: "c_q4_tent_launch",
    name: "Q4 Tent Launch",
    level: "campaign",
    parentId: null,
    shape: "turbulence",
    adsets: [
      { name: "Interest — Camping", shape: "turbulence" },
      { name: "Interest — Hiking", shape: "turbulence" },
      { name: "Broad Test", shape: "turbulence" },
    ],
  },
  {
    id: "c_always_on_search",
    name: "Always-On Advantage+",
    level: "campaign",
    parentId: null,
    shape: "scale",
    adsets: [{ name: "Advantage+ Shopping", shape: "scale" }],
  },
  {
    id: "c_creative_testing",
    name: "Creative Testing Hub",
    level: "campaign",
    parentId: null,
    shape: "rip_current",
    adsets: [
      { name: "Test — UGC v1", shape: "rip_current" },
      { name: "Test — UGC v2", shape: "rip_current" },
      { name: "Test — Studio", shape: "rip_current" },
      { name: "Test — Founder VO", shape: "rip_current" },
      { name: "Test — Static", shape: "rip_current" },
    ],
  },
];

/** 28 days ending yesterday, so the window is always "the last four weeks". */
export function reportingWindow(today = new Date()): { since: string; until: string; days: string[] } {
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() - 1);
  const days: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - i);
    days.push(day.toISOString().slice(0, 10));
  }
  return { since: days[0], until: days[days.length - 1], days };
}

function shapeFor(shape: string, dayIndex: number, total: number, random: () => number) {
  const progress = dayIndex / (total - 1);
  const jitter = 0.9 + random() * 0.2;

  switch (shape) {
    case "cruising":
      return { cpmMult: 1 * jitter, cvrMult: 1 * jitter, spendMult: 1 * jitter, freq: 1.6 + progress * 0.2 };
    case "fatigue":
      // Frequency climbs, click-through and conversion decay on the same creative.
      return {
        cpmMult: (1 + progress * 0.25) * jitter,
        cvrMult: (1 - progress * 0.45) * jitter,
        spendMult: 1 * jitter,
        freq: 2.1 + progress * 2.4,
      };
    case "turbulence":
      // Erratic: volume too low to leave learning, cost swings hard.
      return {
        cpmMult: (1 + Math.sin(dayIndex) * 0.35) * jitter,
        cvrMult: (0.75 + Math.cos(dayIndex * 1.3) * 0.4) * jitter,
        spendMult: (0.6 + random() * 0.9) * jitter,
        freq: 1.2 + random() * 0.3,
      };
    case "scale":
      return {
        cpmMult: (1 - progress * 0.08) * jitter,
        cvrMult: (1 + progress * 0.22) * jitter,
        spendMult: (1 + progress * 0.15) * jitter,
        freq: 1.7,
      };
    case "rip_current":
      // Rising CPM and falling conversion rate together, spend fragmented.
      return {
        cpmMult: (1 + progress * 0.55) * jitter,
        cvrMult: (1 - progress * 0.5) * jitter,
        spendMult: 0.35 * jitter,
        freq: 1.4 + progress * 0.5,
      };
    default:
      return { cpmMult: jitter, cvrMult: jitter, spendMult: jitter, freq: 1.5 };
  }
}

let cache: { entities: Entity[]; rows: DayRow[]; frequency: Map<string, number> } | null = null;

export function dataset() {
  if (cache) return cache;

  const { days } = reportingWindow();
  const entities: Entity[] = [];
  const rows: DayRow[] = [];
  const freqTotals = new Map<string, number[]>();
  const random = rng(20260831);

  for (const campaign of CAMPAIGNS) {
    entities.push({ id: campaign.id, name: campaign.name, level: "campaign", parentId: null });

    campaign.adsets.forEach((adset, index) => {
      const adsetId = `${campaign.id}__as${index + 1}`;
      entities.push({
        id: adsetId,
        name: adset.name,
        level: "adset",
        parentId: campaign.id,
        launchedOn: days[Math.floor(random() * 6)],
      });

      const baseSpend = 40 + random() * 160;
      const baseCpm = 9 + random() * 14;
      const baseCtr = 0.008 + random() * 0.014;
      const baseCvr = 0.02 + random() * 0.05;
      const aov = 60 + random() * 90;

      days.forEach((date, dayIndex) => {
        const s = shapeFor(adset.shape, dayIndex, days.length, random);
        const spend = baseSpend * s.spendMult;
        const cpm = baseCpm * s.cpmMult;
        const impressions = Math.round((spend / cpm) * 1000);
        const clicks = Math.round(impressions * baseCtr * (0.9 + random() * 0.2));
        const conversions = Math.max(0, Math.round(clicks * baseCvr * s.cvrMult));
        const revenue = conversions * aov * (0.9 + random() * 0.2);

        rows.push({
          date,
          entityId: adsetId,
          spend: Number(spend.toFixed(2)),
          impressions,
          clicks,
          conversions,
          revenue: Number(revenue.toFixed(2)),
        });

        const list = freqTotals.get(adsetId) ?? [];
        list.push(s.freq);
        freqTotals.set(adsetId, list);
      });
    });
  }

  const frequency = new Map<string, number>();
  for (const [id, values] of freqTotals) {
    frequency.set(id, values.reduce((a, b) => a + b, 0) / values.length);
  }

  cache = { entities, rows, frequency };
  return cache;
}
