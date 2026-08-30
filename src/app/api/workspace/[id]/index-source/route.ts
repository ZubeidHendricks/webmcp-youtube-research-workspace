import { NextResponse } from "next/server";
import { indexTranscript } from "@/lib/rag/index-transcript";
import { readWorkspace } from "@/lib/workspace/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ID_PATTERN = /^[a-z0-9-]{4,40}$/;

/** Indexes a collected source's transcript for retrieval, however it arrived. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Malformed workspace id." }, { status: 400 });
  }

  let videoId: string;
  try {
    ({ videoId } = (await request.json()) as { videoId: string });
  } catch {
    return NextResponse.json({ error: "Body must be JSON with a videoId." }, { status: 400 });
  }

  const workspace = await readWorkspace(id);
  const source = workspace.sources.find((item) => item.videoId === videoId);

  if (!source) {
    return NextResponse.json({ error: `No collected source ${videoId}.` }, { status: 404 });
  }
  if (!source.transcript?.length) {
    return NextResponse.json(
      { error: "That source has no transcript yet — supply one with provide_transcript." },
      { status: 409 },
    );
  }

  try {
    const passages = await indexTranscript(id, videoId, source.title, source.transcript);
    return NextResponse.json({ passages, title: source.title });
  } catch (error) {
    console.error("[api/workspace/index-source]", error);
    return NextResponse.json({ error: "Could not index that transcript." }, { status: 502 });
  }
}
