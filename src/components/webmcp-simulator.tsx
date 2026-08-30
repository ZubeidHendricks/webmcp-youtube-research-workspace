/**
 * Minimal in-page implementation of `document.modelContext`, enabled only with
 * `?agent-sim=1`.
 *
 * WebMCP ships in ChatGPT's browser and behind a Chrome flag; without either,
 * the page's tools never register and there is no way to exercise them. This
 * installs a spec-shaped stand-in *before* React hydrates, so the app's real
 * registration path runs unchanged and the tools can be called from the console:
 *
 *   await document.modelContext.getTools()
 *   await document.modelContext.executeTool("search_videos", '{"query":"…"}')
 *
 * It is a test harness, not a polyfill — it does nothing without the query
 * parameter, and it does not make the page work with a real agent.
 */
const SIMULATOR = `
(function () {
  try {
    if (!location.search.includes("agent-sim=1")) return;
    if (document.modelContext) return;
    var tools = new Map();
    document.modelContext = {
      __simulated: true,
      registerTool: function (tool, options) {
        tools.set(tool.name, tool);
        if (options && options.signal) {
          options.signal.addEventListener("abort", function () { tools.delete(tool.name); });
        }
        return Promise.resolve();
      },
      getTools: function () {
        return Promise.resolve(Array.from(tools.values()).map(function (tool) {
          return { name: tool.name, description: tool.description, inputSchema: tool.inputSchema };
        }));
      },
      executeTool: function (target, argsJson) {
        var name = typeof target === "string" ? target : target && target.name;
        var tool = tools.get(name);
        if (!tool) return Promise.reject(new Error("No such tool: " + name));
        var input;
        try { input = argsJson ? JSON.parse(argsJson) : {}; }
        catch (error) { return Promise.reject(new Error("Arguments must be a JSON string")); }
        return Promise.resolve(tool.execute(input, { signal: new AbortController().signal }));
      },
    };
  } catch (error) {
    console.error("[webmcp-sim] failed to install", error);
  }
})();
`;

export function WebMcpSimulator() {
  return (
    <script
      id="webmcp-simulator"
      // Must run before hydration so tools register against it.
      dangerouslySetInnerHTML={{ __html: SIMULATOR }}
    />
  );
}
