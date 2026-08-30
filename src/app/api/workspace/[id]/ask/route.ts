import { NextResponse } from "next/server";
import { askSources } from "@/lib/rag/ask";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ID_PATTERN = /^[a-z0-9-]{4,40}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Malformed workspace id." }, { status: 400 });
  }

  let question: string;
  try {
    ({ question } = (await request.json()) as { question: string });
  } catch {
    return NextResponse.json({ error: "Body must be JSON with a question." }, { status: 400 });
  }

  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json({ error: "Provide a question." }, { status: 400 });
  }

  try {
    return NextResponse.json(await askSources(id, question.trim().slice(0, 500)));
  } catch (error) {
    console.error("[api/workspace/ask]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not answer." },
      { status: 502 },
    );
  }
}
