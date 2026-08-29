import { NextResponse } from "next/server";
import { getVideo } from "@/lib/youtube/search";
import { MissingApiKeyError } from "@/lib/youtube/client";
import { extractVideoId } from "@/lib/youtube/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("videoId")?.trim();
  const videoId = raw ? extractVideoId(raw) : null;

  if (!videoId) {
    return NextResponse.json(
      { error: "Missing or malformed ?videoId= (expected an 11-character id or a YouTube URL)." },
      { status: 400 },
    );
  }

  try {
    const video = await getVideo(videoId);
    if (!video) {
      return NextResponse.json({ error: `No video found for id ${videoId}.` }, { status: 404 });
    }
    return NextResponse.json(video);
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("[api/youtube/video]", error);
    return NextResponse.json({ error: "Video lookup failed." }, { status: 502 });
  }
}
