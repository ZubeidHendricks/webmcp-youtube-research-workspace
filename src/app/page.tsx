import { AgentStatus } from "@/components/agent-status";
import { ResearchTools } from "@/components/research-tools";
import { Workspace } from "@/components/workspace";
import { WorkspaceProvider } from "@/lib/workspace-store";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">YouTube Research Workspace</h1>
        <p className="max-w-2xl text-sm text-foreground/60">
          Search YouTube, collect sources, and build a cited set of notes — together with an
          AI agent. The page registers its own tools with the browser via WebMCP, so your
          agent works inside the same workspace you do.
        </p>
      </header>

      <WorkspaceProvider>
        <AgentStatus />
        <Workspace />
        <ResearchTools />
      </WorkspaceProvider>
    </main>
  );
}
