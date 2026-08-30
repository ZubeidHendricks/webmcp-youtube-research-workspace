# Submission text

Paste-ready answers for the Devpost submission form. Replace the project name once chosen.

---

## Why this use case is a strong fit for WebMCP

Video research is asymmetric work. A person can judge in seconds whether a source is worth
their time, but reading an hour of video to find the three moments that matter is punishing.
An agent is the reverse: it can read an hour of transcript instantly, but it has nowhere to
put what it finds. Today that gap is bridged by copy-paste — the agent summarizes in a chat
window, the person retypes the useful parts into a document, and the citation back to the
exact moment in the video is lost on the way.

WebMCP closes the gap by putting both parties inside the same page. The workspace exposes
its own operations as tools, so the agent isn't describing research it did elsewhere — it is
*doing* research in the artifact the person is looking at. A citation the agent files at
4:12 of a talk appears immediately in the researcher's notes panel as a clickable timestamp.
A note the researcher writes by hand is visible to the agent on its next `read_workspace`
call. Neither is reporting to the other; they are editing the same thing.

That only works if the tools are the page's own state, which is exactly what WebMCP provides
and what a conventional MCP server cannot: a server-side MCP tool can fetch a transcript,
but it cannot put a citation on the screen in front of you.

## How it creates a better user experience

- **Findings land where the work is.** Agent output is a row in the notes panel, anchored to
  a video and a timestamp, not a paragraph in a chat log to be transcribed.
- **Citations stay verifiable.** Every anchored note deep-links to the exact second, so a
  claim can be checked in one click instead of taken on faith.
- **The agent can direct attention.** `set_focus` changes what is on screen, so an agent
  explaining a comparison can put the relevant source in front of you as it talks.
- **Neither party is blocked by the other.** The full workspace works with no agent present,
  and the agent can work while the researcher reads. State is shared, not handed off.

## What people and agents can do together that was difficult before

Ask an agent to *"find where these three talks disagree about agent memory, and cite each
one."* The agent searches YouTube, collects the sources, reads their transcripts filtered to
the relevant term, and files three timestamped citations with its reasoning attached — into
the researcher's own workspace, while the researcher is reading the first source and adding
notes of their own. Both sets of notes sit in one list, labelled by author.

Previously this was either fully manual (scrub three videos yourself) or fully delegated
(accept a chat summary with no verifiable anchors). The collaborative middle — an agent
contributing verifiable, clickable citations into a document you are simultaneously editing
— had no natural home on the web.

## How WebMCP was implemented

The app is a Next.js App Router application. A small `useWebMcpTool` hook wraps
`document.modelContext.registerTool`, registering one tool for a component's lifetime and
tying registration to an `AbortController` so unmounting unregisters cleanly. It holds the
`execute` callback in a ref so tools always read current state without re-registering on
every render, which would otherwise churn the agent's tool list.

Eight tools are registered from a single component, `src/components/research-tools.tsx`:
`search_videos`, `collect_source`, `read_transcript`, `cite_moment`, `add_note`,
`read_workspace`, `set_focus`, and `remove_item`.

The structural decision that makes the collaboration real is `src/lib/workspace-actions.ts`:
the human UI and the WebMCP tools call the *same* functions. A click and a tool call are one
operation, not two code paths that drift apart. YouTube access sits behind Next.js route
handlers so API keys never reach the client.

On safety, transcript text is untrusted third-party content, so every tool validates its own
input, transcript responses are capped so a long video cannot flood the agent's context, no
tool acts on instructions found inside transcript text, and the one destructive tool asks for
confirmation in its description.

Transcripts are deliberately best-effort: YouTube withholds auto-generated caption tracks
from datacenter IPs, so when a fetch fails the tool tells the agent to read the video by its
own means and cite anyway — `cite_moment` never required a successful transcript fetch. The
page contributes the workspace and the citation structure; the agent contributes reading it
can do better anyway.
