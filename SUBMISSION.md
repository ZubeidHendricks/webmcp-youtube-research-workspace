# Submission text — Dispatch

Paste-ready answers for the Devpost form.

**Live:** https://yougo.k53.tech · **Repo:** https://github.com/ZubeidHendricks/dispatch-room

---

## Why this use case is a strong fit for WebMCP

Reviewing an ad account is asymmetric work. A media buyer can tell in seconds whether a
reading is plausible, but pulling the numbers that justify it across five campaigns and
thirteen ad sets is an afternoon. An agent is the reverse: it can read every line instantly,
but it has nowhere to put what it finds — and no way to be held to the numbers.

Today that gap is bridged by copy-paste. The agent writes a summary in a chat window, the
buyer retypes the useful parts into a document, and the link back to the specific metric is
lost on the way. That last part matters more than it sounds: "CPM is climbing in Creative
Testing" is worth nothing if nobody can check it, and a memo full of unverifiable claims is
worse than no memo, because people act on it.

Putting the tools in the page closes both halves. The agent calls `file_finding` and it
appears in the buyer's memo as a claim with a citation they can click through to the numbers
behind it. More importantly, **the claim is verified before it lands** — `file_finding`
re-reads the cited metric from the account and refuses the finding if the value is wrong. An
agent that cannot point at the number does not get to make the claim.

That is only possible because the tools are the page's own state. A conventional MCP server
can fetch these metrics; it cannot put a finding in front of you, take your verdict, and let
a second agent argue with it.

## How it creates a better user experience

- **Findings arrive where the decision is made**, as rows in the memo, not paragraphs in a
  chat log to be transcribed.
- **Every claim is checkable.** Each finding carries the metric, entity and value it rests
  on, and one click shows the numbers behind it.
- **Fabrication is refused, not caught later.** A finding citing a CPM of $4.10 when the real
  figure is $20.88 is rejected with the true number.
- **Disagreement stays on the record.** Dismissed findings remain visible, struck through,
  with the reason — so next week's memo can be read against this week's argument.
- **Several agents work at once**, each under its own name, alongside the humans.

## What people and agents can do together that was difficult before

Open a room and send the link to your strategist. Both of you have an agent. Press *Send the
analyst team*: three agents join and, over about ninety seconds, an Analyst files findings
with citations, a Skeptic rules on each one, and a Strategist files what happens Monday —
while you both watch and rule on findings yourselves.

In a real run the Skeptic dismissed a rip-current claim as *"single-period snapshot; cannot
verify a rising CPM trend"* and a fatigue claim because *"frequency 3.30 is higher than other
sets but CTR and CVR are stable"*. It accepted a scale recommendation on evidence of 8.40×
ROAS and $10.27 CPA. That argument — between two agents, in front of the person who has to
act — had no natural home on the web before.

## How WebMCP was implemented

A `useWebMcpTool` hook wraps `document.modelContext.registerTool`, registering one tool per
component lifetime, tying registration to an `AbortController` so unmounting unregisters, and
holding `execute` in a ref so tools read current state without re-registering each render.

Ten tools are registered from `src/components/memo-tools.tsx`: `get_account_summary`,
`get_breakdown`, `check_metric`, `file_finding`, `set_finding_status`, `read_memo`,
`dispatch_analyst_team`, `set_focus`, `join_room`, `list_participants`.

The UI and the tools call the same endpoints, so a number an agent cites is the number on the
buyer's screen rather than a second implementation that can drift. Shared room state lives in
Upstash Redis, split into separate structures rather than one document — a single JSON blob
with compare-and-set lost 4 of 10 concurrent writes in testing, while `RPUSH` for findings
holds 20 parallel writes from three agents.

On safety: there is no free-form query tool, so a steered agent has no vocabulary beyond the
fixed shapes; campaign names written by people outside the buyer's organisation are fenced in
guillemets so the model reads them as data, never instruction; every tool validates its own
input; and nothing writes to an ad account.

Judges cannot connect a Meta ad account, so the room runs on a seeded deterministic account
of 5 campaigns and 13 ad sets over 28 days, shaped so each situation in the taxonomy actually
occurs. Every visitor sees identical numbers — which is what makes a citation checkable.
