import { NextResponse } from "next/server";
import { searchPapers } from "@/lib/papers/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const limit = Number(searchParams.get("limit") ?? 8);

  if (!query) return NextResponse.json({ error: "Missing ?q= search query." }, { status: 400 });

  try {
    const results = await searchPapers(query, Number.isFinite(limit) ? limit : 8);
    return NextResponse.json({ query, results });
  } catch (error) {
    console.error("[api/papers/search]", error);
    return NextResponse.json({ error: "Search failed." }, { status: 502 });
  }
}
