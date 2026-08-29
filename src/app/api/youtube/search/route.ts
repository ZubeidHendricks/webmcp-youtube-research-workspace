import { NextResponse } from "next/server";
import { searchVideos } from "@/lib/youtube/search";
import { MissingApiKeyError } from "@/lib/youtube/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const limit = Number(searchParams.get("limit") ?? 8);
  // Default to captioned-only; pass ?captioned=any to widen the search.
  const captionedOnly = searchParams.get("captioned") !== "any";

  if (!query) {
    return NextResponse.json({ error: "Missing ?q= search query." }, { status: 400 });
  }

  try {
    const results = await searchVideos(query, {
      maxResults: Number.isFinite(limit) ? limit : 8,
      captionedOnly,
    });
    return NextResponse.json({ query, results, captionedOnly });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[api/youtube/search]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed." },
      { status: 502 },
    );
  }
}
