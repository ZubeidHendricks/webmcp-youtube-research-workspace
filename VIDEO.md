# Demo video plan

Target **2:45** of a 3:00 limit. Judges are not required to watch past three minutes, so the
strongest moment must land early.

Live URL: https://yougo.k53.tech · Record at 1280×720 or larger, browser zoom ~110% so the
notes panel is legible when scaled down.

## What to film — and what not to

Measured on production, so the plan matches reality:

| Feature | Reliable on the live site? |
| --- | --- |
| Shared workspace, two browsers | Yes |
| Research team run | Yes — 16s, 4 sources, 16 notes |
| Critic finding conflicts between sources | Yes |
| Agent tools via ChatGPT's browser | Yes, but rehearse — see risks |
| **Server-fetched transcripts** | **No — 0 of 20 videos tested** |
| Timestamped citations | Only via `provide_transcript` |

YouTube withholds auto-generated captions from datacenter IPs, so do **not** plan a shot
around clicking "Load transcript" and expecting lines to appear. If you want the clickable
timestamp moment, it has to come from an agent supplying the transcript.

## Shot list

**0:00–0:20 — The problem, over a cold open**
Show a 45-minute talk on YouTube. Say: research means finding three useful minutes in
forty-five, and an agent can read it instantly but has nowhere to put what it finds — it
reports back in a chat window and you retype the useful parts, losing the citation.

**0:20–0:35 — What YouGo is**
Open https://yougo.k53.tech. Point out the banner: the page has registered its own tools
with the browser via WebMCP. The URL is a shared room; the link is the invitation.

**0:35–1:20 — The research team (the hero shot)**
Type a topic. Click **Send the research team**. Narrate while it runs — it takes about 16
seconds, so do not cut away:

> Four agents just joined this workspace. Scout picks which sources are worth reading,
> Reader pulls out what each one actually claims, Critic challenges them, and Synthesist
> says where it leaves you.

Let the notes panel fill on camera. Scroll to a Critic note and read one aloud — the
"sources conflict on the security model" kind of line is the moment that sells it.

**1:20–1:50 — Two agents, one artifact**
Open a second browser (or a second window) on the same `/w/<id>` link. Show both participant
lists. Have your agent in window two file a note; show it appear in window one **without a
reload**. Say: everyone in this room, human or agent, edits the same document.

**1:50–2:25 — WebMCP itself**
In ChatGPT's in-app browser on the live URL, ask the agent what tools the page offers, then
give it one instruction — "find sources on X and cite the strongest claim." Show the tool
calls landing in the workspace. This is the part judges score hardest on, so let it breathe.

**2:25–2:45 — Close**
One sentence on implementation: twelve tools registered with
`document.modelContext.registerTool`, shared state in Redis, the human UI and the agent
tools calling the same functions so a click and a tool call are the same operation.

## Rehearse these risks

1. **Do the ChatGPT browser run at least twice before recording.** Nobody has yet confirmed
   a real agent picks up all twelve tools — the tooling has been verified with a simulator
   and with direct calls, not with ChatGPT itself.
2. **Use a fresh workspace id** for the take so the notes panel starts empty.
3. **Hard-refresh first.** A cached build has already caused confusion once.
4. If you want a timestamped citation on camera, ask the agent to read the video and call
   `provide_transcript`, then cite from it. Test that exact exchange before recording.
5. No copyrighted music. Keep third-party logos incidental.

## Sentences worth saying verbatim

- "The link is the invitation — anyone who opens it, and any agent driving their browser,
  works in the same sources and notes."
- "The agent isn't describing research it did somewhere else. It's doing research in the
  document I'm looking at."
- "Every citation is anchored to a timestamp, so I can check the claim in one click instead
  of taking it on faith."
