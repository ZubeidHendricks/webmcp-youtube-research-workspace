# Devpost form — field by field

Form: https://devpost.com/submit-to/31011-the-webmcp-challenge/manage/submissions/1167682/project-overview

---

## Project name

```
Dispatch
```

## Elevator pitch (200 characters)

```
A shared decision memo for an ad account. Agents file findings through the page's own WebMCP tools — every claim must cite a number, and the number is verified before the finding lands.
```

(179 characters.)

## About the project

Paste the whole block below into the story editor.

### Inspiration

Every week, somebody writes the memo for each ad account. It is asymmetric work: a media
buyer can tell in seconds whether a reading is plausible, but pulling the numbers that
justify it across five campaigns and thirteen ad sets is an afternoon. An agent is the
reverse — it reads every line instantly, but it has nowhere to put what it finds, and no
way to be held to the numbers it quotes.

Today that gap is bridged by copy-paste. The agent writes a summary in a chat window, the
buyer retypes the useful parts into a document, and the link back to the specific metric is
lost on the way. That matters more than it sounds: "CPM is climbing in Creative Testing" is
worth nothing if nobody can check it, and a memo full of unverifiable claims is worse than
no memo, because people act on it.

### What it does

Dispatch is a room built around one shared memo for one ad account. Open it, send the link
to a colleague, and both of you — plus any agent driving either browser — work the same memo
live.

- Agents call `file_finding`, and the finding appears in the memo as a claim with a citation
  you can click through to the numbers behind it.
- **The claim is verified before it lands.** `file_finding` re-reads the cited metric from
  the account and refuses the finding if the value is wrong. An agent that cannot point at
  the number does not get to make the claim.
- A human accepts or dismisses each finding. Dismissed findings stay visible, struck through,
  with the reason — so next week's memo can be read against this week's argument.
- Press *Send the analyst team* and three agents join: an Analyst files findings with
  citations, a Skeptic rules on each one, and a Strategist files what happens Monday.

In a real run the Skeptic dismissed a rip-current claim as "single-period snapshot; cannot
verify a rising CPM trend", and accepted a scale recommendation on evidence of 8.40x ROAS and
$10.27 CPA. Two agents disagreeing in front of the person who has to act — that argument had
no natural home on the web before.

### How we built it

A `useWebMcpTool` hook wraps `document.modelContext.registerTool`: one tool per component
lifetime, registration tied to an `AbortController` so unmounting unregisters, and `execute`
held in a ref so tools read current state without re-registering on every render.

Ten tools are registered from `src/components/memo-tools.tsx` — `get_account_summary`,
`get_breakdown`, `check_metric`, `file_finding`, `set_finding_status`, `read_memo`,
`dispatch_analyst_team`, `set_focus`, `join_room`, `list_participants`.

The UI and the tools call the same endpoints, so a number an agent cites is the number on the
buyer's screen, not a second implementation that can drift. Shared room state lives in Upstash
Redis.

Because judges cannot connect a Meta ad account, the room runs on a seeded deterministic
account — 5 campaigns, 13 ad sets, 28 days — shaped so each situation in the taxonomy
actually occurs. Every visitor sees identical numbers, which is what makes a citation
checkable.

### Challenges we ran into

Concurrency was the real one. Modelling the room as a single JSON document with
compare-and-set lost 4 of 10 concurrent writes in testing. Splitting the state into separate
Redis structures — `RPUSH` for findings — held 20 parallel writes from three agents.

Safety was the other. There is no free-form query tool, so a steered agent has no vocabulary
beyond the fixed shapes; campaign names written by people outside the buyer's organisation
are fenced in guillemets so the model reads them as data, never instruction; every tool
validates its own input; and nothing writes to an ad account.

### Accomplishments that we're proud of

Fabrication is refused, not caught later. A finding citing a CPM of $4.10 when the real figure
is $20.88 is rejected with the true number, at the moment it is filed.

### What we learned

Putting the tools in the page changes what an agent is for. A conventional MCP server can
fetch these metrics; it cannot put a finding in front of you, take your verdict, and let a
second agent argue with it.

### What's next for Dispatch

A live Meta Marketing API connection behind the same tool surface, so the citation check runs
against a real account; and memo history, so this week's argument is read against last
week's.

---

## Built with

```
next.js, react, typescript, webmcp, model-context-protocol, upstash-redis, vercel-ai-sdk, groq, tailwind-css, vercel
```

## Try it out links

```
https://yougo.k53.tech
https://github.com/ZubeidHendricks/dispatch-room
```

## Video demo link

Not yet recorded — see VIDEO.md.

---

## Challenge questions

The four long-form answers are in SUBMISSION.md, in the form's order:

1. Why this use case is a strong fit for WebMCP
2. How it creates a better user experience
3. What people and agents can do together that was difficult before
4. How WebMCP was implemented
