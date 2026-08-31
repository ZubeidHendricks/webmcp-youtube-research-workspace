"use client";

import { useEffect, useState } from "react";
import { useRoom, type Finding } from "@/lib/room-store";
import { useAccount, type AccountSummary } from "@/lib/room-actions";
import { useAnalystTeam } from "@/lib/team-client";
import { formatMetric } from "@/lib/account/query";
import type { Breakdown } from "@/lib/account/query";
import { KIND_LABEL, isActive, orderFindings } from "@/lib/room/types";

const KIND_TONE: Record<string, string> = {
  cruising: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  scale: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  turbulence: "bg-amber-500/15 text-amber-900 dark:text-amber-300",
  fatigue: "bg-orange-500/15 text-orange-900 dark:text-orange-300",
  rip_current: "bg-red-500/15 text-red-900 dark:text-red-300",
  consolidate: "bg-violet-500/15 text-violet-900 dark:text-violet-300",
};

export function MemoRoom() {
  const { shared, identity, focus, setFocus, offline, apply } = useRoom();
  const { summary, campaigns, adsets } = useAccount();
  const dispatchTeam = useAnalystTeam();

  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [rows, setRows] = useState<Breakdown[]>([]);
  const [detail, setDetail] = useState<Breakdown[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void summary().then(setAccount).catch(() => setError("Could not load the account."));
    void campaigns().then((d) => setRows(d.rows)).catch(() => {});
  }, [summary, campaigns]);

  useEffect(() => {
    if (focus.kind !== "entity") return;
    void adsets(focus.entityId).then((d) => setDetail(d.rows)).catch(() => setDetail([]));
  }, [focus, adsets]);

  const findings = orderFindings(shared.findings);
  const visibleParticipants = shared.participants.filter(
    (p) => isActive(p) || p.id === identity.id || findings.some((f) => f.authorId === p.id),
  );

  async function guard(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {account && <AccountBar account={account} />}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={dispatching}
          onClick={() => {
            setDispatching(true);
            void guard(async () => {
              await dispatchTeam();
              setFocus({ kind: "memo" });
            }).then(() => setDispatching(false));
          }}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {dispatching ? "Working…" : "Send the analyst team"}
        </button>
        <span className="text-xs text-foreground/50">
          Analyst → Skeptic → Strategist, filing into this memo
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-[190px_1fr]">
        <nav className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => setFocus({ kind: "memo" })}
            className={tabClass(focus.kind === "memo")}
          >
            Memo ({findings.length})
          </button>
          <button
            type="button"
            onClick={() => setFocus({ kind: "campaigns" })}
            className={tabClass(focus.kind === "campaigns")}
          >
            Campaigns ({rows.length})
          </button>
          {rows.length > 0 && <p className="mt-3 px-2 text-xs text-foreground/40">Drill in</p>}
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setFocus({ kind: "entity", entityId: row.id })}
              className={tabClass(focus.kind === "entity" && focus.entityId === row.id)}
              title={row.name}
            >
              <span className="line-clamp-2 text-left">{row.name}</span>
            </button>
          ))}
        </nav>

        <main className="min-w-0">
          {focus.kind === "memo" && (
            <MemoPane
              findings={findings}
              onVerdict={(finding, status) =>
                void guard(() =>
                  apply({
                    type: "set_status",
                    findingId: finding.id,
                    status,
                    verdictNote: `${identity.label} ${status} it`,
                  }),
                )
              }
              onShowEntity={(entityId) => setFocus({ kind: "entity", entityId })}
            />
          )}
          {focus.kind === "campaigns" && <Table rows={rows} onOpen={(id) => setFocus({ kind: "entity", entityId: id })} />}
          {focus.kind === "entity" && <Table rows={detail} caption="Ad sets" />}
        </main>
      </div>

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/40">
        <span>
          In this room:{" "}
          {visibleParticipants.length === 0
            ? "just you"
            : visibleParticipants.map((p, index) => (
                <span key={p.id} className={isActive(p) ? undefined : "opacity-50"}>
                  {index > 0 && ", "}
                  {p.label}
                  {p.id === identity.id && " (you)"}
                </span>
              ))}
        </span>
        {offline && <span className="text-amber-600 dark:text-amber-400">{offline}</span>}
      </footer>
    </div>
  );
}

function tabClass(active: boolean) {
  return `rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
    active ? "bg-foreground text-background" : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10"
  }`;
}

function AccountBar({ account }: { account: AccountSummary }) {
  const m = account.metrics;
  const cells: [string, string][] = [
    ["Spend", formatMetric("spend", m.spend)],
    ["Revenue", formatMetric("revenue", m.revenue)],
    ["ROAS", formatMetric("roas", m.roas)],
    ["CPA", formatMetric("cpa", m.cpa)],
    ["CPM", formatMetric("cpm", m.cpm)],
    ["CTR", formatMetric("ctr", m.ctr)],
  ];

  return (
    <section className="rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
      <p className="text-xs text-foreground/50">
        {account.account.name} · {account.window.since} to {account.window.until}
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-y-2 sm:grid-cols-6">
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-wide text-foreground/40">{label}</dt>
            <dd className="font-mono text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function MemoPane({
  findings,
  onVerdict,
  onShowEntity,
}: {
  findings: Finding[];
  onVerdict: (finding: Finding, status: "accepted" | "dismissed") => void;
  onShowEntity: (entityId: string) => void;
}) {
  if (findings.length === 0) {
    return (
      <p className="text-sm text-foreground/50">
        No findings yet. Send the analyst team, or ask your agent to read the account and file
        what it sees.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
      {findings.map((finding) => (
        <li key={finding.id} className="flex flex-col gap-1.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                KIND_TONE[finding.kind] ?? "bg-black/5 dark:bg-white/10"
              }`}
            >
              {KIND_LABEL[finding.kind]}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-foreground/40">
              sev {finding.severity} · {finding.authorLabel}
            </span>
            {finding.status !== "open" && (
              <span className="text-[10px] uppercase tracking-wide text-foreground/40">
                {finding.status}
              </span>
            )}
          </div>

          <p
            className={`text-sm font-medium ${
              finding.status === "dismissed" ? "text-foreground/40 line-through" : ""
            }`}
          >
            {finding.headline}
          </p>

          {finding.rationale && <p className="text-sm text-foreground/70">{finding.rationale}</p>}

          <button
            type="button"
            onClick={() => onShowEntity(finding.citation.entityId)}
            className="w-fit font-mono text-xs text-foreground/45 hover:text-foreground hover:underline"
            title="Show the numbers behind this"
          >
            {finding.citation.metric} {finding.citation.value} · {finding.citation.entityName}
          </button>

          {finding.verdictNote && (
            <p className="text-xs italic text-foreground/50">{finding.verdictNote}</p>
          )}

          {finding.status === "open" && (
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => onVerdict(finding, "accepted")}
                className="rounded-md border border-black/15 px-2.5 py-1 text-xs transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => onVerdict(finding, "dismissed")}
                className="rounded-md px-2.5 py-1 text-xs text-foreground/50 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              >
                Dismiss
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Table({
  rows,
  caption,
  onOpen,
}: {
  rows: Breakdown[];
  caption?: string;
  onOpen?: (id: string) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-foreground/50">Nothing here.</p>;

  return (
    <div className="overflow-x-auto">
      {caption && <p className="mb-2 text-xs uppercase tracking-wide text-foreground/40">{caption}</p>}
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-black/10 text-left text-[10px] uppercase tracking-wide text-foreground/40 dark:border-white/15">
            <th className="py-2 pr-3 font-medium">Name</th>
            {["Spend", "CPM", "CTR", "CVR", "CPA", "ROAS", "Freq"].map((h) => (
              <th key={h} className="py-2 pr-3 text-right font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-black/5 last:border-0 dark:border-white/10">
              <td className="py-2 pr-3">
                {onOpen ? (
                  <button type="button" onClick={() => onOpen(row.id)} className="text-left hover:underline">
                    {row.name}
                  </button>
                ) : (
                  row.name
                )}
              </td>
              {(["spend", "cpm", "ctr", "cvr", "cpa", "roas", "frequency"] as const).map((metric) => (
                <td key={metric} className="py-2 pr-3 text-right font-mono text-xs">
                  {formatMetric(metric, row.metrics[metric])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
