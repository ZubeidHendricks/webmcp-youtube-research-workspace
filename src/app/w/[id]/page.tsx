import { AgentStatus } from "@/components/agent-status";
import { ResearchTools } from "@/components/research-tools";
import { Workspace } from "@/components/workspace";
import { WorkspaceProvider } from "@/lib/workspace-store";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">YouGo</h1>
        <p className="max-w-2xl text-sm text-foreground/60">
          A shared research session. Anyone with this link — and any agent driving their
          browser — works in the same sources and notes, live. The page registers its own
          tools via WebMCP, so your agent contributes here rather than in a chat window.
        </p>
      </header>

      <WorkspaceProvider workspaceId={id}>
        <AgentStatus />
        <Workspace />
        <ResearchTools />
      </WorkspaceProvider>
    </main>
  );
}
