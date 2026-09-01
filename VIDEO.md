# Demo video plan — Dispatch

Target **2:40** of a 3:00 limit. Judges need not watch past three minutes, so the strongest
moment must land early.

**Live:** https://yougo.k53.tech · Record at 1280×720+, browser zoom ~110%.

## What is reliable

Measured on production:

| Feature | Reliable? |
| --- | --- |
| Account tables and drill-down | Yes |
| Analyst team run | Yes — ~90s, ~9 findings |
| Skeptic accepting and dismissing with reasons | Yes |
| Citation refusal on a wrong number | Yes |
| Accept/dismiss from the UI | Yes |
| Tools in ChatGPT's browser | **Unverified — rehearse** |

## Shot list

**0:00–0:15 — The problem**
Over a spreadsheet or a chat window: every week someone writes the memo for each account. An
agent could read the numbers instantly, but it has nowhere to put what it finds, and no way
to be held to the figures it quotes.

**0:15–0:30 — What this is**
Open the room. Point at the account bar and the banner: the page has registered its own tools
with the browser. The link is the invitation.

**0:30–1:25 — The analyst team (hero shot)**
Press **Send the analyst team**. Narrate for the ~90 seconds while findings appear:

> Three agents just joined. The Analyst reads the account and files findings — each one has
> to cite a number. The Skeptic rules on every finding. The Strategist says what happens
> Monday.

Scroll to a dismissed finding and read the Skeptic's reason aloud. That argument between two
agents is the moment that sells it.

**1:25–1:55 — The citation check (the differentiator)**
In ChatGPT's browser, ask the agent to file a finding with a number you know is wrong — or
show the console call. The refusal is the shot:

> Refused: you cited cpm as $4.10, but it is $20.88 for Creative Testing Hub.

> An agent that can't point at the number doesn't get to make the claim.

**1:55–2:20 — The human's verdict**
Accept one finding, dismiss another with a reason. Show the memo reorder, and the dismissed
one struck through but still readable. Note that a second agent sees your verdict on its next
`read_memo`.

**2:20–2:40 — Close**
Ten tools registered with `document.modelContext.registerTool`; shared state in Redis so two
people and their agents work one memo; citations verified server-side before they land.

## Rehearse

1. **The ChatGPT browser run, twice.** Tools are verified with the simulator and by direct
   calls, not yet by ChatGPT itself. Highest-scoring segment, only real unknown.
2. **Fresh room id** so the memo starts empty.
3. **Hard-refresh first.** A cached build has caused confusion twice.
4. Say clearly that the account is demo data — do not imply a live Meta connection.
5. No copyrighted music; keep third-party logos incidental.

## Lines worth saying verbatim

- "An agent that can't point at the number doesn't get to make the claim."
- "The agent isn't summarising analysis it did somewhere else — it's filing into the memo
  I'm reading."
- "Two agents disagreeing in front of the person who has to act. That's what a memo is for."
