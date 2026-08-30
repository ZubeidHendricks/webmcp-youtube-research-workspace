import { NextResponse } from "next/server";
import { runResearchTeam } from "@/lib/team/run";
import { mutateWorkspace } from "@/lib/workspace/server";

export const dynamic = "force-dynamic";
/** The team makes several model calls in sequence; give it room. */
export const maxDuration = 300;

const ID_PATTERN = /^[a-z0-9-]{4,40}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Malformed workspace id." }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "The research team is not configured (GROQ_API_KEY is missing)." },
      { status: 503 },
    );
  }

  let topic: string;
  try {
    ({ topic } = (await request.json()) as { topic: string });
  } catch {
    return NextResponse.json({ error: "Body must be JSON with a topic." }, { status: 400 });
  }

  if (typeof topic !== "string" || topic.trim().length === 0) {
    return NextResponse.json({ error: "Provide a topic to research." }, { status: 400 });
  }

  try {
    await runResearchTeam(id, topic.trim().slice(0, 200));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/workspace/team]", error);
    // Leave a trace in the workspace itself — the researcher is watching it, not the console.
    await mutateWorkspace(id, {
      type: "add_note",
      note: {
        authorId: `team-error-${id}`,
        authorLabel: "Research team",
        authorKind: "agent",
        text: `The team stopped early: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      },
    }).catch(() => {});
    return NextResponse.json({ error: "The research team failed." }, { status: 502 });
  }
}
