import { NextResponse } from "next/server";
import { getPaper } from "@/lib/papers/search";
import { extractPaperId } from "@/lib/papers/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("sourceId")?.trim();
  const sourceId = raw ? extractPaperId(raw) : null;

  if (!sourceId) {
    return NextResponse.json(
      { error: "Missing or malformed ?sourceId= (expected an arXiv id or URL)." },
      { status: 400 },
    );
  }

  try {
    const paper = await getPaper(sourceId);
    if (!paper) {
      return NextResponse.json({ error: `No paper found for ${sourceId}.` }, { status: 404 });
    }
    return NextResponse.json(paper);
  } catch (error) {
    console.error("[api/papers/paper]", error);
    return NextResponse.json({ error: "Lookup failed." }, { status: 502 });
  }
}
