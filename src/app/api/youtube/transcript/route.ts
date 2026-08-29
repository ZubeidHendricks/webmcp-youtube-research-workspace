import { NextResponse } from "next/server";
import { getTranscript, TranscriptUnavailableError } from "@/lib/youtube/transcript";
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
    const transcript = await getTranscript(videoId);
    return NextResponse.json(transcript);
  } catch (error) {
    if (error instanceof TranscriptUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[api/youtube/transcript]", error);
    return NextResponse.json({ error: "Transcript lookup failed." }, { status: 502 });
  }
}
