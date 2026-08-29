# YouTube Research Workspace

> **Placeholder name.** The WebMCP Challenge rules prohibit AI-generated project names —
> rename this before submitting.

A research workspace for YouTube that a person and an AI agent operate **together**. The
page registers its own tools with the browser through
[WebMCP](https://github.com/webmachinelearning/webmcp)
(`document.modelContext.registerTool`), so whatever agent is driving the page can search
YouTube, read transcripts, and file cited notes into the same workspace the human is
looking at — and can read back what the human did.

**Live:** https://webmcp-youtube-research-workspace-28n2v61uf.vercel.app

Built for [The WebMCP Challenge](https://webmcp.devpost.com/). The YouTube layer is adapted
from [ZubeidHendricks/youtube-mcp-server](https://github.com/ZubeidHendricks/youtube-mcp-server),
an existing stdio MCP server; this project moves that capability *into the page*, where the
agent and the human share one artifact instead of the agent working alone in a chat window.

## Why WebMCP fits

Video research is slow for a person (transcripts are long) and blind for an agent (a chat
agent can summarize a video but can't hand you a workspace). Splitting it works badly in
both directions. Here the two halves share state:

- The agent calls `read_transcript` with a query filter and finds the three moments that
  matter across an hour of video.
- It calls `cite_moment`, and a timestamped, clickable citation appears in the researcher's
  notes panel — with the agent's reasoning attached.
- It calls `set_focus` to put the relevant source on screen while it explains.
- The researcher cites a moment themselves; the agent sees it on its next `read_workspace`.

## Registered tools

| Tool | What it does |
| --- | --- |
| `search_videos` | Searches YouTube; results appear in the workspace |
| `collect_source` | Pulls a video into the workspace as a research source |
| `read_transcript` | Reads a source's timestamped transcript, filterable by query or time range |
| `cite_moment` | Files a citation anchored to an exact moment, with commentary |
| `add_note` | Adds a freeform note — a synthesis, question, or next step |
| `read_workspace` | Reads current topic, sources, and all notes (including the human's) |
| `set_focus` | Changes what the researcher sees on screen |
| `remove_item` | Removes a source or note (destructive; confirmation requested) |

## Setup

```bash
npm install
cp .env.example .env.local   # add a YouTube Data API v3 key
npm run dev                  # http://localhost:3000
```

`YOUTUBE_API_KEY` is required. `YOUTUBE_API_KEY2` / `YOUTUBE_API_KEY3` are optional quota
fallbacks — the client pool marks a key exhausted on a quota error and rolls to the next.

The app works as an ordinary web app in any browser. To exercise the agent tools you need a
WebMCP-capable browser:

- **ChatGPT's in-app browser** — native WebMCP support
- **Chrome 149+** — enable the experimental WebMCP flag at `chrome://flags`

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
  lib/youtube/client.ts          Quota-rotating YouTube Data API pool
  lib/youtube/search.ts          Video search + details
  lib/youtube/transcript.ts      Timestamped captions
  app/api/youtube/*              Route handlers (keys stay server-side)
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

Transcript text is untrusted third-party content, and page tools run on behalf of whoever
is driving the agent — see Chrome's
[security guide](https://developer.chrome.com/docs/ai/webmcp/secure-tools). This app:

1. **Validates every tool input in `execute`.** The model can send values outside the
   declared `enum`, malformed timestamps, or absent required fields.
2. **Returns transcript text as data, never as instruction.** No tool acts on content found
   inside a transcript; `read_transcript` says so in its own description.
3. **Caps transcript responses** at 12,000 characters so a long video can't flood the
   agent's context.
4. **Keeps API keys server-side.** Tools call this app's route handlers, never YouTube
   directly.
5. **Marks `remove_item` as destructive** and asks the agent to confirm before calling it.

## Known limitation: transcripts in production

Transcripts come from YouTube's caption endpoint via `youtube-transcript`, not an
authenticated API. Measured behaviour, local vs. this app's Vercel deployment:

| Video | Caption track | Local | Vercel |
| --- | --- | --- | --- |
| `dQw4w9WgXcQ` | manually uploaded | ✅ | ✅ |
| `Is2NHa7awWY` | auto-generated (ASR) | ✅ | ❌ |
| `EoNH3Tn8wYE` | auto-generated (ASR) | ✅ | ❌ |
| `jNQXAC9IVRw` | auto-generated (ASR) | ✅ | ❌ |

The result is deterministic, not rate limiting: **YouTube serves manually uploaded caption
tracks to datacenter IPs but withholds auto-generated ones.** Most videos only have ASR
captions, so `read_transcript` fails for most videos in production while working everywhere
locally. Search and video lookup are unaffected — they use the official Data API.

Routing through YouTube's InnerTube API (`youtubei.js`) was tried and does not help; its
`get_transcript` endpoint returns HTTP 400 regardless of IP.

Known ways to fix it, none free:

- a residential/rotating proxy for caption fetches only
- a third-party transcript API (Supadata, youtube-transcript.io, etc.)
- restricting the demo to videos with publisher-uploaded captions

The UI surfaces a failure as a per-source message rather than a hard error, so the
workspace stays usable when a transcript can't be fetched.

## Deploy

```bash
npx vercel                                     # preview
npx vercel env add YOUTUBE_API_KEY production  # then set the key
npx vercel --prod
```

## License

MIT — see [LICENSE](./LICENSE).
