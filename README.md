# WebMCP Task Board

> **Placeholder name.** The WebMCP Challenge rules say the project name must not be
> AI-generated — rename this before submitting.

A Next.js starter for [The WebMCP Challenge](https://webmcp.devpost.com/). It exposes its
own interface to AI agents through the WebMCP browser API
(`document.modelContext.registerTool`), so a person and their agent operate the same board:
anything the agent does is immediately visible on screen, and anything the person does is
visible to the agent on the next `list_tasks` call.

## Registered tools

| Tool | What it does |
| --- | --- |
| `list_tasks` | Lists tasks, optionally filtered by status |
| `add_task` | Adds an open task |
| `set_task_status` | Marks a task done or reopens it |
| `delete_task` | Deletes a task (agent is told to confirm first) |
| `set_board_filter` | Changes what the human sees on screen |

## Getting started

```bash
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

The app works as a normal web app in any browser. To exercise the agent tools you need a
WebMCP-capable browser:

- **ChatGPT's in-app browser** — native WebMCP support
- **Chrome 149+** — enable the experimental WebMCP flag at `chrome://flags`

A banner at the top of the page tells you which mode you're in. Chrome DevTools has a
[WebMCP panel](https://developer.chrome.com/docs/devtools/application/webmcp) for
inspecting registered tools.

## Project layout

```
src/
  types/webmcp.d.ts             Ambient types for document.modelContext
  lib/webmcp/support.ts         Feature detection
  lib/webmcp/use-webmcp-tool.ts React hook: registers one tool for a component's lifetime
  lib/tasks-store.tsx           Shared state the UI and the tools both operate on
  components/task-tools.tsx     ← add your tools here
  components/task-board.tsx     Human UI
  components/agent-status.tsx   "Agent tools active" banner
```

### Adding a tool

```tsx
useWebMcpTool<{ query?: string }>({
  name: "search_tasks",
  description: "Find tasks whose title contains the query.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  execute: ({ query }) => {
    if (!query) return "Provide a query.";
    // ...
    return "…a short factual string the agent can relay";
  },
});
```

`useWebMcpTool` keeps `execute` in a ref, so tools always read fresh state without
re-registering on every render (re-registering churns the agent's tool list). Registration
is tied to an `AbortController`, so unmounting the component unregisters the tool.

## Writing safe tools

Page tools run on behalf of whoever is driving the agent, and page content can carry
prompt injection — see Chrome's
[security guide](https://developer.chrome.com/docs/ai/webmcp/secure-tools). The tools here
follow three rules:

1. **Validate every input in `execute`.** The model can send anything, including values
   outside your `enum`.
2. **Never expose a capability the signed-in human doesn't already have.** Tools are not an
   authorization bypass; enforce the same checks as your UI.
3. **Mark destructive tools as needing confirmation** in the description, and keep them
   narrow.

## Deploying to Vercel

```bash
npx vercel        # preview
npx vercel --prod # production
```

The live URL is what judges and agents will hit, so deploy early and keep it up.

## Reference

- [WebMCP specification](https://github.com/webmachinelearning/webmcp)
- [Chrome WebMCP docs](https://developer.chrome.com/docs/ai/webmcp) ·
  [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Vercel's reference implementation](https://github.com/vercel/shop/pull/498)

## License

MIT — see [LICENSE](./LICENSE).
