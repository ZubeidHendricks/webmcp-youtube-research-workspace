import { AgentStatus } from "@/components/agent-status";
import { TaskBoard } from "@/components/task-board";
import { TaskTools } from "@/components/task-tools";
import { TasksProvider } from "@/lib/tasks-store";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">WebMCP Task Board</h1>
        <p className="text-sm text-foreground/60">
          A starter app that exposes its own UI as tools an AI agent can call, using the
          WebMCP <code className="font-mono text-xs">document.modelContext</code> API.
        </p>
      </header>

      <TasksProvider>
        <AgentStatus />
        <TaskBoard />
        <TaskTools />
      </TasksProvider>

      <footer className="mt-auto text-xs text-foreground/40">
        Tools registered: list_tasks, add_task, set_task_status, delete_task,
        set_board_filter.
      </footer>
    </main>
  );
}
