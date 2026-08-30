# YouGo

A research workspace for papers that people and their AI agents operate **together**. The
page registers its own tools with the browser through
[WebMCP](https://github.com/webmachinelearning/webmcp)
(`document.modelContext.registerTool`), so whatever agent is driving the page can search
arXiv, read full texts, and file cited notes into the same workspace the human is looking
at — and can read back what everyone else did.

**Live:** https://yougo.k53.tech

Built for [The WebMCP Challenge](https://webmcp.devpost.com/).

## Shared workspaces

Every workspace has a URL — `/w/<id>` — and the link is the invitation. Everyone who opens
it, and every agent driving one of those browsers, works in the same sources and notes.
Contributions carry their author, so the notes panel shows which agent or person filed
what, and `read_workspace` shows an agent what the humans have been doing.

Two agents in two browsers can genuinely work the same problem: one collecting and citing,
another reading the same sources and filing counterpoints, while a person watches both
land. Identity is per-tab, so a person and their agent appear separately; participants who
stop checking in drop off the list after 90 seconds.

State lives in Upstash Redis (provisioned through the Vercel Marketplace) behind
`/api/workspace/[id]`, and browsers poll for changes every two seconds.

### Why the storage is shaped the way it is

The workspace is stored as separate Redis structures — a hash of sources, a list of notes,
a hash of participants — rather than one JSON document. A single document with
compare-and-set **lost 4 of 10 concurrent notes** in testing, because several agents writing
at once is the normal case here, not an edge case. With `RPUSH` for notes and `HSETNX` for
sources, 20 parallel notes from three agents all survive, and eight simultaneous collects of
the same video collapse to one source.

## Asking the sources

Once a paper's full text has been read, it is indexed for retrieval, and `ask_sources` (or
the ask box above the panes) answers questions from it:

> **Q:** What defence does this paper propose, and how well does it work?
> **A:** …UniGuardian, a framework that detects prompt-trigger attacks at inference time…
> — *"we propose UniGuardian, a novel framework"* · **Abstract**

Retrieval runs across every collected paper at once, so it answers cross-source questions —
where several papers agree, and where they conflict. The answer and each supporting quote
are filed into the notes, so an answer becomes part of the shared artifact rather than a
message that scrolls away.

**How it works.** Paragraphs are merged into ~1,200-character chunks that never cross a
section boundary, embedded by Upstash Vector's hosted model into a per-workspace namespace.
The question is embedded the same way, so wording that appears nowhere in the paper still
retrieves the right passage.

**Citations open the paper at the words.** Each citation links with a
[text fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Fragment/Text_fragments)
(`#:~:text=…`), so clicking one opens the paper scrolled to that sentence and highlights it —
the papers equivalent of a video timestamp, and the reason a claim stays checkable.

## The research team

`dispatch_research_team` puts four agents on a topic. They are not a chat thread — each
joins the workspace as a participant and files into it as it goes, so findings arrive on
screen while the run is still going:

| Role | What it contributes |
| --- | --- |
| **Scout** | Reads a dozen candidates and picks the few worth a researcher's time, saying why |
| **Reader** | Pulls quoted claims out of each paper, anchored to the section they came from |
| **Critic** | Challenges the evidence and names what the sources disagree about |
| **Synthesist** | States what is established, what is contested, and what to look at next |

Runs on Groq (`openai/gpt-oss-120b`) via the AI SDK. A run on "prompt injection attacks on
tool-using agents" produced 4 papers — all four read in full — and 16 notes including 8
quoted citations, with the Critic noting that no unified benchmark exists across text, web
and robotic tool-using agents.

The tool returns immediately rather than awaiting the run, because the point is watching
the work land. A person can dispatch the same team from the button under the search box.

## Why papers, not video

This started on YouTube. That failed for a measurable reason: YouTube withholds
auto-generated caption tracks from datacenter IPs — across 20 videos sampled from four
caption-heavy topics, **none** were readable from a deployed server. Citations and Q&A only
worked if an agent supplied a transcript, so a visitor without an agent saw neither.

arXiv serves full text to anyone. Search, metadata and section-tagged paragraphs all work
server-side, so every feature works for every visitor — and the agent tools are then a
genuine multiplier rather than the only way in. Full-text retrieval tries arXiv's own HTML
rendering first and ar5iv as a fallback, twice each, because a single slow response was
otherwise dropping three of four papers in a research run.

## Why WebMCP fits

Reading research is asymmetric work. A person can judge in seconds whether a paper is worth
their time, but reading four of them to find where they actually disagree is a day. An agent
is the reverse: it can read all four instantly, but it has nowhere to put what it finds. The
gap is bridged by copy-paste — the agent summarizes in a chat window, the person retypes the
useful parts, and the citation back to the exact sentence is lost.

WebMCP closes the gap by putting both parties inside the same page. YouGo exposes its own
operations as tools, so an agent isn't describing research it did elsewhere — it is *doing*
research in the artifact the person is looking at:

- The agent calls `ask_sources` and finds the three passages that matter across four papers.
- It calls `cite_passage`, and a quoted citation appears in the researcher's notes panel,
  linking straight to that sentence in the paper.
- It calls `set_focus` to put the relevant paper on screen while it explains.
- The researcher cites a passage themselves; the agent sees it on its next `read_workspace`.

That only works if the tools are the page's own state, which is what WebMCP provides and
what a conventional MCP server cannot: a server-side tool can fetch a paper, but it cannot
put a citation on the screen in front of you.

## Provenance

Everything in this repository was written during the Hackathon Submission Period. The repo
was created 2026-08-29 and its full commit history is public and dated.

An earlier revision adapted two files from the author's pre-existing
[youtube-mcp-server](https://github.com/ZubeidHendricks/youtube-mcp-server) while the corpus
was YouTube; both were removed when the workspace moved to papers, and no code from that
project remains. The history shows the change.

## Third-party terms

- **Groq** — runs the research team's models (`openai/gpt-oss-120b`) via the Vercel AI SDK.
- **Upstash Redis** — shared workspace state, provisioned through the Vercel Marketplace.
- **Upstash Vector** — transcript embeddings and retrieval, using its hosted embedding model.
- **arXiv API** — public, no key, used for search and paper metadata.
- **arXiv HTML / ar5iv** — full text of papers, as published for readers.

## Registered tools

| Tool | What it does |
| --- | --- |
| `search_papers` | Searches arXiv; results appear in the workspace |
| `collect_paper` | Pulls a paper in as a research source |
| `read_paper` | Reads the full text as section-tagged paragraphs, filterable |
| `ask_sources` | Answers a question from the collected papers, with quoted evidence |
| `cite_passage` | Files a citation anchored to an exact quote, with commentary |
| `add_note` | Adds a freeform note — a synthesis, question, or next step |
| `dispatch_research_team` | Puts a four-agent team on a topic; they join and file into the workspace |
| `join_workspace` | Announces an agent under a name so its contributions are labelled |
| `list_participants` | Shows who else — person or agent — is working here |
| `read_workspace` | Reads topic, sources, and all notes, including the humans' |
| `set_focus` | Changes what the researcher sees on screen |
| `remove_item` | Removes a source or note (destructive; confirmation requested) |

## Trying the tools without a WebMCP browser

Append `?agent-sim=1` to any page URL to install a spec-shaped stand-in for
`document.modelContext` before the app hydrates. The app's real registration path runs
unchanged, and the tools become callable from the console:

```js
await document.modelContext.getTools();
await document.modelContext.executeTool("search_papers", '{"query":"ai agents"}');
```

The banner reads "Simulated agent (testing)" so the state is never mistaken for a real
agent. Without the query parameter the stub is not installed and the page behaves normally.

## Setup

```bash
npm install
cp .env.example .env.local   # add a YouTube Data API v3 key
npm run dev                  # http://localhost:3000
```

`GROQ_API_KEY` powers the research team and the answering model. Redis and Vector
credentials are provisioned by the Marketplace commands in `.env.example`. arXiv needs no
key.

The app works as an ordinary web app in any browser — every feature, including citations
and Q&A, works with no agent present. To exercise the agent tools you need a
WebMCP-capable browser:

- **ChatGPT's in-app browser** — native WebMCP support
- **Chrome 149+** — enable the flag at `chrome://flags/#enable-webmcp-testing`

A banner at the top of the page shows which mode you're in. Chrome DevTools has a
[WebMCP panel](https://developer.chrome.com/docs/devtools/application/webmcp) for inspecting
registered tools.

## Architecture

```
src/
  types/webmcp.d.ts              Ambient types for document.modelContext
  lib/webmcp/use-webmcp-tool.ts  Hook: registers one tool for a component's lifetime
  lib/webmcp/support.ts          Feature detection
  lib/workspace-store.tsx        Shared state: topic, sources, notes, focus
  lib/workspace-actions.ts       Operations the UI and the tools both call
  lib/papers/search.ts           arXiv search and metadata
  lib/papers/fulltext.ts         Section-tagged full text, with a fallback renderer
  lib/rag/index-passages.ts      Chunking + Upstash Vector indexing and retrieval
  lib/rag/ask.ts                 Grounded answering with quoted citations
  lib/team/run.ts                The four-role research team pipeline
  lib/workspace/server.ts        Redis-backed shared state
  app/api/papers/*               Route handlers
  components/research-tools.tsx  ← the agent-facing surface
  components/workspace.tsx       Human UI
  components/agent-status.tsx    "Agent tools active" banner
```

The important structural choice is `lib/workspace-actions.ts`: the human UI and the WebMCP
tools call the *same* functions, so a click and a tool call are genuinely equivalent rather
than two code paths that drift apart.

`useWebMcpTool` keeps `execute` in a ref so tools always read fresh state without
re-registering on every render (re-registering churns the agent's tool list), and ties
registration to an `AbortController` so unmounting unregisters the tool.

## Security notes

Paper text is untrusted third-party content, and page tools run on behalf of whoever is
driving the agent — see Chrome's
[security guide](https://developer.chrome.com/docs/ai/webmcp/secure-tools). This app:

1. **Validates every tool input in `execute`.** The model can send values outside the
   declared `enum`, malformed ids, or absent required fields.
2. **Returns paper text as data, never as instruction.** No tool acts on content found
   inside a paper; `read_paper` and the answering prompt both say so.
3. **Caps text responses** at 14,000 characters so a long paper can't flood the agent's
   context.
4. **Keeps keys server-side.** Tools call this app's route handlers.
5. **Marks `remove_item` as destructive** and asks the agent to confirm before calling it.

## Deploy

```bash
npx vercel                                     # preview
npx vercel env add YOUTUBE_API_KEY production  # then set the key
npx vercel --prod
```

## License

MIT — see [LICENSE](./LICENSE).
