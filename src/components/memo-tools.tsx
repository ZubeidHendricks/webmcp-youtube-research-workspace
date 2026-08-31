"use client";

import { useWebMcpTool } from "@/lib/webmcp/use-webmcp-tool";
import { useRoom } from "@/lib/room-store";
import { useAccount } from "@/lib/room-actions";
import { useAnalystTeam } from "@/lib/team-client";
import { formatMetric } from "@/lib/account/query";
import {
  FINDING_KINDS,
  KIND_GUIDANCE,
  isActive,
  orderFindings,
  type FindingKind,
  type FindingStatus,
} from "@/lib/room/types";

/**
 * The agent-facing surface of the memo room.
 *
 * Two rules carried over from ZubeidHendricks/dispatch:
 *
 *  1. There is no free-form query tool. Every shape an agent can ask for is
 *     defined here, so a confused — or steered — agent has no vocabulary for
 *     anything else.
 *  2. A finding cannot be filed without a citation, and the citation is checked
 *     against the account before the finding lands. An analyst who cannot point
 *     at the number does not get to make the claim.
 *
 * Campaign and ad set names come from outside the buyer's org, so anything that
 * came from the account is returned as data the agent summarises, never as
 * instruction.
 */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function count(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

/** Wrap account-sourced text so the model reads it as data. */
function fence(text: string): string {
  return `«${text.replace(/[«»]/g, "")}»`;
}

const METRIC_NAMES = [
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "revenue",
  "cpm",
  "ctr",
  "cvr",
  "cpa",
  "roas",
  "frequency",
] as const;

/** How far a cited value may be off before the finding is refused. */
const CITATION_TOLERANCE = 0.02;

export function MemoTools() {
  const { readLive, identity, setIdentity, apply, setFocus } = useRoom();
  const { summary, campaigns, adsets, checkMetric } = useAccount();
  const dispatchTeam = useAnalystTeam();

  useWebMcpTool({
    name: "get_account_summary",
    description:
      "Account-level totals and efficiency for the reporting window. Start here to size the account before drilling in.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      try {
        const data = await summary();
        const m = data.metrics;
        return [
          `${fence(data.account.name)} — ${data.window.since} to ${data.window.until}`,
          `spend ${formatMetric("spend", m.spend)} · revenue ${formatMetric("revenue", m.revenue)} · roas ${formatMetric("roas", m.roas)}`,
          `cpm ${formatMetric("cpm", m.cpm)} · ctr ${formatMetric("ctr", m.ctr)} · cvr ${formatMetric("cvr", m.cvr)} · cpa ${formatMetric("cpa", m.cpa)}`,
          `conversions ${formatMetric("conversions", m.conversions)} · avg frequency ${formatMetric("frequency", m.frequency)}`,
        ].join("\n");
      } catch (error) {
        return `Could not read the account: ${errorText(error)}`;
      }
    },
  });

  useWebMcpTool<{ level?: string; campaign?: string }>({
    name: "get_breakdown",
    description:
      "Per-campaign or per-ad-set performance for the reporting window, sorted by spend. Pass a campaign to see its ad sets. This is where fragmentation, fatigue and instability become visible.",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["campaign", "adset"] },
        campaign: {
          type: "string",
          description: "Campaign id or name, when asking for ad sets.",
        },
      },
      required: ["level"],
    },
    execute: async ({ level, campaign }) => {
      try {
        const data = level === "adset" ? await adsets(campaign) : await campaigns();
        if (data.rows.length === 0) return "Nothing at that level.";
        return [
          `${level === "adset" ? "Ad sets" : "Campaigns"}, ${data.window.since} to ${data.window.until}:`,
          ...data.rows.map((row) => {
            const m = row.metrics;
            return `- ${fence(row.name)} [${row.id}] spend ${formatMetric("spend", m.spend)} · cpm ${formatMetric("cpm", m.cpm)} · ctr ${formatMetric("ctr", m.ctr)} · cvr ${formatMetric("cvr", m.cvr)} · cpa ${formatMetric("cpa", m.cpa)} · roas ${formatMetric("roas", m.roas)} · freq ${formatMetric("frequency", m.frequency)}`;
          }),
        ].join("\n");
      } catch (error) {
        return `Could not read the breakdown: ${errorText(error)}`;
      }
    },
  });

  useWebMcpTool<{ metric?: string; entity?: string }>({
    name: "check_metric",
    description:
      "Look up one metric for one entity, as the buyer's screen shows it. Use this to confirm a number before you cite it — file_finding checks the citation anyway and will refuse a claim whose number is wrong.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: [...METRIC_NAMES] },
        entity: {
          type: "string",
          description: "Campaign or ad set id/name. Omit for account level.",
        },
      },
      required: ["metric"],
    },
    execute: async ({ metric, entity }) => {
      if (!metric) return "Provide a metric.";
      try {
        const check = await checkMetric(metric, entity);
        return `${metric} for ${fence(check.entityName)} (${check.level}) over ${check.window.since}–${check.window.until}: ${check.display}`;
      } catch (error) {
        return `Could not check that metric: ${errorText(error)}`;
      }
    },
  });

  useWebMcpTool<{
    kind?: string;
    severity?: number;
    headline?: string;
    rationale?: string;
    entity?: string;
    metric?: string;
    value?: string;
  }>({
    name: "file_finding",
    description: `File a finding into the memo. Every finding needs a citation — the metric and value you are relying on — and the value is checked against the account before it lands, so cite what you actually read. Kinds: ${FINDING_KINDS.map((k) => `${k} (${KIND_GUIDANCE[k].split(".")[0]})`).join("; ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...FINDING_KINDS] },
        severity: {
          type: "number",
          description: "1 = worth knowing, 2 = act this week, 3 = act today.",
        },
        headline: { type: "string", description: "One sentence, specific, no hedging." },
        rationale: { type: "string", description: "Why this reading follows from the numbers." },
        entity: { type: "string", description: "Campaign or ad set id/name. Omit for account level." },
        metric: { type: "string", enum: [...METRIC_NAMES] },
        value: { type: "string", description: "The value you observed, as displayed." },
      },
      required: ["kind", "severity", "headline", "metric"],
    },
    execute: async ({ kind, severity, headline, rationale, entity, metric, value }) => {
      if (!kind || !FINDING_KINDS.includes(kind as FindingKind)) {
        return `kind must be one of: ${FINDING_KINDS.join(", ")}.`;
      }
      if (!headline?.trim()) return "Provide a headline.";
      if (!metric) return "Provide the metric your finding rests on.";

      const level = Math.round(Number(severity));
      if (![1, 2, 3].includes(level)) return "severity must be 1, 2 or 3.";

      try {
        const check = await checkMetric(metric, entity);

        // The citation is checked before the finding lands: a claim whose number
        // is wrong is worse than no claim, because the memo is read as evidence.
        if (value && check.value != null) {
          const claimed = Number(String(value).replace(/[^0-9.-]/g, ""));
          if (Number.isFinite(claimed) && check.value !== 0) {
            const drift = Math.abs(claimed - check.value) / Math.abs(check.value);
            if (drift > CITATION_TOLERANCE) {
              return `Refused: you cited ${metric} as ${value}, but it is ${check.display} for ${fence(check.entityName)}. Re-read the number and file again.`;
            }
          }
        }

        await apply({
          type: "file_finding",
          finding: {
            kind: kind as FindingKind,
            severity: level as 1 | 2 | 3,
            headline: headline.trim(),
            rationale: rationale?.trim() ?? "",
            citation: {
              level: check.level,
              entityId: check.entityId,
              entityName: check.entityName,
              metric,
              window: check.window,
              value: check.display,
            },
            authorId: identity.id,
            authorLabel: identity.label,
            authorKind: identity.kind,
          },
        });

        setFocus({ kind: "memo" });
        return `Filed. ${count(readLive().findings.length, "finding")} in the memo. Citation: ${metric} ${check.display} for ${fence(check.entityName)}.`;
      } catch (error) {
        return `Could not file that finding: ${errorText(error)}`;
      }
    },
  });

  useWebMcpTool<{ finding?: string; status?: string; note?: string }>({
    name: "set_finding_status",
    description:
      "Accept or dismiss a finding, with a reason. Accepting means it goes in the memo the buyer acts on; dismissing keeps it visible but struck through, so the disagreement stays on the record.",
    inputSchema: {
      type: "object",
      properties: {
        finding: { type: "string", description: "The finding's headline or id." },
        status: { type: "string", enum: ["open", "accepted", "dismissed"] },
        note: { type: "string", description: "Why." },
      },
      required: ["finding", "status"],
    },
    execute: async ({ finding, status, note }) => {
      if (!finding) return "Provide which finding.";
      if (!status || !["open", "accepted", "dismissed"].includes(status)) {
        return "status must be open, accepted or dismissed.";
      }
      const needle = finding.trim().toLowerCase();
      const match =
        readLive().findings.find((f) => f.id === finding.trim()) ??
        readLive().findings.find((f) => f.headline.toLowerCase().includes(needle));
      if (!match) return `No finding matching "${finding}". Call read_memo first.`;

      try {
        await apply({
          type: "set_status",
          findingId: match.id,
          status: status as FindingStatus,
          verdictNote: note?.trim(),
        });
        return `"${match.headline}" is now ${status}.`;
      } catch (error) {
        return `Could not update that finding: ${errorText(error)}`;
      }
    },
  });

  useWebMcpTool({
    name: "read_memo",
    description:
      "Read the memo as it stands — every finding, who filed it, its citation and whether the buyer accepted it. Call this first to catch up before adding anything, and again to see what the humans decided.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const { findings, participants } = readLive();
      const lines = [
        `Participants (${participants.length}):`,
        ...(participants.length === 0
          ? ["  (just you)"]
          : participants.map(
              (p) => `  - ${p.label} (${p.kind})${isActive(p) ? "" : " — finished"}`,
            )),
        "",
        `Findings (${findings.length}):`,
      ];

      if (findings.length === 0) {
        lines.push("  (none yet)");
      } else {
        for (const f of orderFindings(findings)) {
          lines.push(
            `  - [${f.kind} · sev ${f.severity} · ${f.status}] ${f.headline}` +
              ` — ${f.citation.metric} ${f.citation.value} for ${fence(f.citation.entityName)}` +
              ` (filed by ${f.authorLabel})` +
              (f.verdictNote ? ` — verdict: ${f.verdictNote}` : ""),
          );
        }
      }
      return lines.join("\n");
    },
  });

  useWebMcpTool<{ show?: string; entity?: string }>({
    name: "set_focus",
    description:
      "Change what the buyer is looking at — the memo, the campaign table, or one campaign's detail. Use it to direct attention while you explain something.",
    inputSchema: {
      type: "object",
      properties: {
        show: { type: "string", enum: ["memo", "campaigns", "entity"] },
        entity: { type: "string", description: "Required when show is 'entity'." },
      },
      required: ["show"],
    },
    execute: async ({ show, entity }) => {
      if (show === "memo") {
        setFocus({ kind: "memo" });
        return "Showing the memo.";
      }
      if (show === "campaigns") {
        setFocus({ kind: "campaigns" });
        return "Showing the campaign table.";
      }
      if (show === "entity") {
        if (!entity) return "Provide which campaign to show.";
        try {
          const check = await checkMetric("spend", entity);
          setFocus({ kind: "entity", entityId: check.entityId });
          return `Showing ${fence(check.entityName)}.`;
        } catch {
          return `No campaign or ad set matching "${entity}".`;
        }
      }
      return "show must be 'memo', 'campaigns' or 'entity'.";
    },
  });

  useWebMcpTool({
    name: "dispatch_analyst_team",
    description:
      "Put a three-agent team on this account: Analyst reads it and files findings with citations, Skeptic accepts or dismisses each one, Strategist decides what happens Monday. They join the room and file as they go, so watch it arrive with read_memo rather than waiting on this call.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      try {
        return await dispatchTeam();
      } catch (error) {
        return `Could not dispatch the team: ${errorText(error)}`;
      }
    },
  });

  useWebMcpTool<{ name?: string }>({
    name: "join_room",
    description:
      "Announce yourself under a name, so your findings are labelled and the buyer can see who is working. Call this once at the start.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "How you want to appear." } },
      required: ["name"],
    },
    execute: async ({ name }) => {
      if (!name?.trim()) return "Provide the name you want to appear under.";
      const label = name.trim().slice(0, 40);
      await setIdentity({ id: identity.id, label, kind: "agent" });
      const others = readLive().participants.filter((p) => p.id !== identity.id);
      return others.length === 0
        ? `Joined as "${label}". Nobody else is here yet.`
        : `Joined as "${label}". Also here: ${others.map((p) => `${p.label} (${p.kind})`).join(", ")}.`;
    },
  });

  useWebMcpTool({
    name: "list_participants",
    description: "Who else is working this account — people and other agents — and what they filed.",
    inputSchema: { type: "object", properties: {} },
    execute: () => {
      const { participants, findings } = readLive();
      if (participants.length === 0) return "Nobody has announced themselves yet.";
      return participants
        .map((p) => {
          const filed = findings.filter((f) => f.authorId === p.id).length;
          return `- ${p.label} (${p.kind}) — ${count(filed, "finding")}${
            p.id === identity.id ? " — this is you" : isActive(p) ? "" : " — finished"
          }`;
        })
        .join("\n");
    },
  });

  return null;
}
