# Demo video plan — YouGo

Target **2:45** of a 3:00 limit. Judges are not required to watch past three minutes, so the
strongest moment must land early.

**Live:** https://yougo.k53.tech · Record at 1280×720 or larger, browser zoom ~110% so the
notes panel stays legible when scaled down.

## What is reliable on the live site

Measured on production, so the plan matches reality rather than hope:

| Feature | Reliable? |
| --- | --- |
| Shared workspace across two browsers | Yes |
| Research team run | Yes — ~16-25s, 4 sources, ~16 notes |
| Critic naming conflicts between sources | Yes |
| `ask_sources` answering with clickable citations | Yes, once a transcript is in |
| Agent supplying a transcript (`provide_transcript`) | Yes |
| **Server-fetched transcripts** | **No — 0 of 20 videos tested** |
| A real ChatGPT agent driving all 13 tools | **Unverified — rehearse this** |

YouTube withholds auto-generated captions from datacenter IPs, so never plan a shot around
clicking "Load transcript" and expecting lines to appear. Transcripts reach the workspace
through an agent, and that path works.

## Shot list

**0:00–0:18 — The problem**
Over a long talk on YouTube: research means finding three useful minutes in forty-five. An
agent can read it instantly but has nowhere to put what it finds — it reports in a chat
window, you retype the useful parts, and the citation is lost.

**0:18–0:32 — What YouGo is**
Open https://yougo.k53.tech. Point at the banner: the page has registered its own tools with
the browser via WebMCP. The URL is a shared room; the link is the invitation.

**0:32–1:15 — The research team (hero shot)**
Type a topic, click **Send the research team**. Narrate while it runs — about twenty seconds,
so do not cut away:

> Four agents just joined this workspace. Scout picks the sources worth reading, Reader pulls
> out what each one actually claims, Critic challenges them, Synthesist says where it leaves
> you.

Let the notes fill on camera. Scroll to a Critic note and read it aloud — the "these two
sources conflict on the security model" kind of line is what sells it.

**1:15–1:50 — Ask the sources (the payoff)**
Type a question into the ask box in plain language — deliberately *not* the wording used in
the videos. Show the answer arrive with quoted evidence, then **click a timestamp** and let
YouTube open at that exact second.

> It answers from the transcripts themselves, and every claim links to the moment it was
> said. The answer and its citations are now part of the notes, not a message that scrolls
> away.

**1:50–2:20 — Two agents, one artifact**
Second browser window on the same `/w/<id>` link. Show both participant lists. File a note in
window two; show it appear in window one **without a reload**. Everyone in this room — human
or agent — edits the same document.

**2:20–2:45 — Implementation close**
Thirteen tools registered with `document.modelContext.registerTool`; shared state in Redis;
transcript retrieval in a vector index; the human UI and the agent tools calling the same
functions, so a click and a tool call are the same operation.

## Rehearse before recording

1. **The ChatGPT browser run, at least twice.** Nobody has confirmed a real agent picks up
   all thirteen tools — they are verified with a spec-shaped simulator and by direct calls,
   not by ChatGPT itself. This is the highest-scoring segment and the only real unknown.
2. **Get a transcript in before the ask shot.** Either have your agent read a video and call
   `provide_transcript`, or use a source the team already transcribed. Test the exact exchange.
3. **Fresh workspace id for the take**, so the notes panel starts empty.
4. **Hard-refresh first.** A cached build has caused confusion twice.
5. **Choose the topic deliberately.** Scout's picks appear on camera and judges read them.
6. No copyrighted music; keep third-party logos incidental.

## Lines worth saying verbatim

- "The link is the invitation — anyone who opens it, and any agent driving their browser,
  works in the same sources and notes."
- "The agent isn't describing research it did somewhere else. It's doing research in the
  document I'm looking at."
- "Every citation is anchored to a timestamp, so I can check the claim in one click instead
  of taking it on faith."
