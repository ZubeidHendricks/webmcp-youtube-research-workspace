import { NextResponse } from "next/server";
import { runAnalystTeam } from "@/lib/team/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ID_PATTERN = /^[a-z0-9-]{4,40}$/;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Malformed room id." }, { status: 400 });
  }
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "The analyst team is not configured (GROQ_API_KEY is missing)." },
      { status: 503 },
    );
  }

  try {
    await runAnalystTeam(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/room/team]", error);
    return NextResponse.json({ error: "The analyst team failed." }, { status: 502 });
  }
}
