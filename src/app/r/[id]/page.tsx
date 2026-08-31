import { AgentStatus } from "@/components/agent-status";
import { MemoRoom } from "@/components/memo-room";
import { MemoTools } from "@/components/memo-tools";
import { RoomProvider } from "@/lib/room-store";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dispatch</h1>
        <p className="max-w-2xl text-sm text-foreground/60">
          The weekly decision memo for an ad account, written in the room rather than handed
          over. Agents read the account and file findings that must cite a number; you accept
          or dismiss each one. Everyone with this link — and every agent driving their browser —
          works on the same memo.
        </p>
      </header>

      <RoomProvider roomId={id}>
        <AgentStatus />
        <MemoRoom />
        <MemoTools />
      </RoomProvider>
    </main>
  );
}
