# Dispatch

**Live:** https://yougo.k53.tech

The weekly decision memo for an ad account, written **in the room** rather than handed over.

Agents read the account and file findings; every finding must cite a number, and the number
is checked before the finding lands. A human accepts or dismisses each one. Everyone with
the link — and every agent driving their browser — works on the same memo, live.

The page registers its own tools with the browser through
[WebMCP](https://github.com/webmachinelearning/webmcp)
(`document.modelContext.registerTool`), so an agent isn't describing analysis it did
somewhere else. It is doing the analysis in the document the buyer is reading.

Built for [The WebMCP Challenge](https://webmcp.devpost.com/).

## Why this fits WebMCP

Reviewing an ad account is asymmetric work. A buyer can tell in seconds whether a reading is
plausible, but pulling the numbers that justify it across five campaigns and thirteen ad sets
is an afternoon. An agent is the reverse: it can read every line instantly, but it has
nowhere to put what it finds, and no way to be held to the numbers.

Today the gap is bridged by copy-paste — the agent writes a summary in a chat window, the
buyer retypes the useful parts into a doc, and the link back to the specific metric is lost.
Which matters, because *"CPM is climbing in Creative Testing"* is worth nothing if nobody can
check it.

Putting the tools in the page closes both halves:

- The agent calls `file_finding`, and it appears in the buyer's memo as a claim with a
  citation they can click through to the numbers behind it.
- **The claim is verified before it lands.** `file_finding` re-reads the cited metric from the
  account and refuses the finding if the value is wrong — an agent that cannot point at the
  number does not get to make the claim.
- The buyer accepts or dismisses, and the verdict is visible to every agent on its next
  `read_memo`.
- Several agents work at once, each under its own name, and disagreement stays on the record
  rather than being resolved silently.

A server-side MCP tool can fetch these metrics. It cannot put a finding in front of you,
take your verdict, and let a second agent argue with it.

## The finding taxonomy

Closed, deliberately. An open-ended "insight" field drifts in wording every run and makes the
diff between two weeks meaningless.

| Kind | When it applies |
| --- | --- |
| `cruising` | Stable and performing. "Leave this alone" is a finding. |
| `turbulence` | In or near learning, or destabilised: low volume, erratic cost. |
| `rip_current` | Rising CPM and falling conversion rate together, usually with too many concurrent tests. Consolidate, never scale. |
| `scale` | Sustained efficiency with headroom. Name the increment. |
| `consolidate` | Spend fragmented across ad sets competing in the same auction. |
| `fatigue` | Frequency climbing while CTR or CVR decays on the same creative. |

Severity is 1 (worth knowing), 2 (act this week) or 3 (act today).

## Registered tools

| Tool | What it does |
| --- | --- |
| `get_account_summary` | Account totals and efficiency for the window |
| `get_breakdown` | Per-campaign or per-ad-set performance, sorted by spend |
| `check_metric` | One metric for one entity, as the buyer's screen shows it |
| `file_finding` | Files a finding — refused if its citation doesn't check out |
| `set_finding_status` | Accepts or dismisses a finding, with a reason |
| `read_memo` | The memo as it stands, with citations and verdicts |
| `dispatch_analyst_team` | Puts Analyst, Skeptic and Strategist on the account |
| `set_focus` | Changes what the buyer sees on screen |
| `join_room` | Announces an agent under a name |
| `list_participants` | Who else is working this account, and what they filed |

## The analyst team

`dispatch_analyst_team` puts three agents on the account. They join as participants and file
as they go, so the memo assembles on screen rather than arriving finished:

| Role | Contributes |
| --- | --- |
| **Analyst** | Reads the account and files findings, each with a citation |
| **Skeptic** | Rules on every finding — accepts or dismisses, and says why |
| **Strategist** | Files what happens Monday: the increment, the consolidation, or an explicit "leave it alone" |

A production run took ~90 seconds and produced 9 findings. The Skeptic accepted 3 and
dismissed 3, killing a rip-current claim as *"single-period snapshot; cannot verify a rising
CPM trend"* and a fatigue claim because *"frequency 3.30 is higher than other sets but CTR
and CVR are stable"*. That disagreement is the point: it is what a memo is for.

## The demo account

Dispatch proper reads a connected Meta ad account. A judge cannot connect one, so the room
runs on a **seeded, deterministic account** — Northwind Outdoor, 5 campaigns, 13 ad sets, 28
days. Every visitor sees identical numbers, which is what makes a citation checkable at all,
and the campaigns are shaped so each situation in the taxonomy actually occurs.

Real Meta ingest is Phase 3 of the parent project, after App Review. Nothing here writes to
any ad account.

## Trying the tools without a WebMCP browser

Append `?agent-sim=1` to any room URL to install a spec-shaped stand-in for
`document.modelContext` before the app hydrates. The real registration path runs unchanged:

```js
await document.modelContext.getTools();
await document.modelContext.executeTool("get_account_summary", "{}");
```

The banner reads "Simulated agent (testing)" so it is never mistaken for a real agent.

## Setup

```bash
npm install
cp .env.example .env.local   # Groq key + Marketplace-provisioned Redis
npm run dev
```

`GROQ_API_KEY` powers the analyst team. Redis credentials come from
`vercel integration add upstash/upstash-kv`. The demo account needs no credentials.

To exercise the agent tools you need ChatGPT's in-app browser, or Chrome 149+ with
`chrome://flags/#enable-webmcp-testing`.

## Architecture

```
src/
  types/webmcp.d.ts             Ambient types for document.modelContext
  lib/webmcp/use-webmcp-tool.ts Hook: registers one tool for a component's lifetime
  lib/account/data.ts           The seeded demo account
  lib/account/query.ts          Fixed query shapes — no free-form query tool
  lib/room/types.ts             Finding taxonomy, citations, room state
  lib/room/server.ts            Redis-backed shared state
  lib/team/run.ts               Analyst → Skeptic → Strategist
  components/memo-tools.tsx     ← the agent-facing surface
  components/memo-room.tsx      The buyer's UI
```

Shared state lives in Upstash Redis, split into separate structures rather than one
document: a single JSON blob with compare-and-set lost 4 of 10 concurrent writes in testing,
while `RPUSH` for findings holds 20 parallel writes from three agents.

## Security notes

Campaign and ad set names are written by people outside the buyer's organisation and flow
straight into a model, so — following Chrome's
[guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools):

1. **There is no free-form query tool.** Every shape an agent can ask for is defined in
   `lib/account/query.ts`; a steered agent has no vocabulary for anything else.
2. **Account-sourced text is fenced** in «guillemets» on the way out, so the model reads it
   as data and never as instruction.
3. **Every tool validates its own input** — the model can send values outside a declared
   `enum`, a severity of 7, or a metric that doesn't exist.
4. **Citations are verified server-side** before a finding is stored.
5. **Nothing writes to an ad account.** The room is read-only over the data.

## Provenance

This repository was created 2026-08-29, inside the Hackathon Submission Period, and its full
commit history is public and dated.

The finding taxonomy, the severity scale, the citation shape and the no-free-form-query rule
are adapted from the author's own
[Dispatch](https://github.com/ZubeidHendricks/dispatch) — a Phase 1 backend with no web app
and no WebMCP, which generates these memos on a cron and emails them. Everything here is new:
the WebMCP layer, the room model, the shared state, all ten tools, the citation check, the
three-agent team, the demo account and the entire interface.

## Third-party terms

- **Groq** — runs the analyst team's models (`openai/gpt-oss-120b`) via the Vercel AI SDK.
- **Upstash Redis** — shared room state, provisioned through the Vercel Marketplace.

## License

MIT — see [LICENSE](./LICENSE).
