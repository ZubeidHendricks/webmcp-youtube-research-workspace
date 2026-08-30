# Submission text — YouGo

Paste-ready answers for the Devpost submission form.

**Live:** https://yougo.k53.tech · **Repo:** https://github.com/ZubeidHendricks/yougo

---

## Why this use case is a strong fit for WebMCP

Video research is asymmetric work. A person can judge in seconds whether a source is worth
their time, but reading an hour of video to find the three moments that matter is punishing.
An agent is the reverse: it can read that hour instantly, but it has nowhere to put what it
finds. Today that gap is bridged by copy-paste — the agent summarizes in a chat window, the
person retypes the useful parts into a document, and the citation back to the exact moment
is lost on the way.

WebMCP closes the gap by putting both parties inside the same page. YouGo exposes its own
operations as tools, so an agent isn't describing research it did elsewhere — it is *doing*
research in the artifact the person is looking at. A citation filed at 4:12 of a talk appears
immediately in the researcher's notes as a clickable timestamp. A note the researcher writes
by hand is visible to the agent on its next `read_workspace` call.

That only works if the tools are the page's own state, which is exactly what WebMCP provides
and what a conventional MCP server cannot: a server-side MCP tool can fetch a transcript, but
it cannot put a citation on the screen in front of you.

## How it creates a better user experience

- **Findings land where the work is.** Agent output is a row in the notes panel, anchored to
  a video and a timestamp, not a paragraph in a chat log to be transcribed.
- **Citations stay verifiable.** Every anchored note deep-links to the exact second, so a
  claim can be checked in one click instead of taken on faith.
- **Questions are answered from the sources, not from memory.** `ask_sources` retrieves
  across every collected transcript and answers with quoted evidence, filing the answer and
  its citations into the notes.
- **The agent can direct attention.** `set_focus` changes what is on screen, so an agent
  explaining a comparison can put the relevant source in front of you as it talks.
- **Nobody is blocked by anyone.** The workspace works with no agent present, several agents
  can work at once, and state is shared rather than handed off.

## What people and agents can do together that was difficult before

Open a workspace and send the link to a colleague. Both of you have an agent. Ask for a
research team on a topic and four agents — Scout, Reader, Critic, Synthesist — join the
workspace and file sources, quoted claims, challenges and a synthesis into it over about
twenty seconds, while both of you watch and add notes of your own. Then ask the collected
sources a question in plain language and get an answer with quotes you can click through to
the exact second.

Previously this was either fully manual (scrub the videos yourself) or fully delegated
(accept a chat summary with no verifiable anchors). The collaborative middle — several
agents and several people contributing verifiable citations into one document they are all
editing at once — had no natural home on the web.

## How WebMCP was implemented

A `useWebMcpTool` hook wraps `document.modelContext.registerTool`, registering one tool for a
component's lifetime, tying registration to an `AbortController` so unmounting unregisters,
and holding `execute` in a ref so tools read current state without re-registering on every
render.

Thirteen tools are registered from `src/components/research-tools.tsx`: `search_videos`,
`collect_source`, `read_transcript`, `provide_transcript`, `cite_moment`, `add_note`,
`ask_sources`, `dispatch_research_team`, `join_workspace`, `list_participants`,
`read_workspace`, `set_focus`, `remove_item`.

The structural decision that makes the collaboration real is `src/lib/workspace-actions.ts`:
the human UI and the WebMCP tools call the *same* functions, so a click and a tool call are
one operation rather than two code paths that drift. Shared state lives in Upstash Redis,
split into separate structures rather than one document — a single JSON blob with
compare-and-set lost 4 of 10 concurrent notes in testing, while `RPUSH` for notes and
`HSETNX` for sources hold 20 parallel writes from three agents. Transcript retrieval uses
Upstash Vector with hosted embeddings, namespaced per workspace.

On safety, transcript text is untrusted third-party content: every tool validates its own
input, transcript responses are capped so a long video cannot flood an agent's context, the
answering model is told to treat passages as evidence and never as instructions, and the one
destructive tool asks for confirmation in its description.

Transcripts are deliberately best-effort. YouTube withholds auto-generated captions from
datacenter IPs — measured across 20 videos, none were readable server-side — so when a fetch
fails the tool tells the agent to read the video by its own means and send the lines back
with `provide_transcript`, after which they render, cite and index exactly like a fetched
transcript. The page contributes the workspace, the citation structure and the retrieval; the
agent contributes reading it can do better anyway.
