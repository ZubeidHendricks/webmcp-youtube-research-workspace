import { NextResponse } from "next/server";
import { FullTextUnavailableError, getFullText } from "@/lib/papers/fulltext";
import { extractPaperId } from "@/lib/papers/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("sourceId")?.trim();
  const sourceId = raw ? extractPaperId(raw) : null;

  if (!sourceId) {
    return NextResponse.json({ error: "Missing or malformed ?sourceId=." }, { status: 400 });
  }

  try {
    return NextResponse.json({ sourceId, passages: await getFullText(sourceId) });
  } catch (error) {
    if (error instanceof FullTextUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[api/papers/fulltext]", error);
    return NextResponse.json({ error: "Full text lookup failed." }, { status: 502 });
  }
}
