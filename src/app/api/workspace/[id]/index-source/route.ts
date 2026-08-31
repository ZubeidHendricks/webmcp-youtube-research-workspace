import { NextResponse } from "next/server";
import { indexPaper } from "@/lib/rag/index-passages";
import { readWorkspace } from "@/lib/workspace/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ID_PATTERN = /^[a-z0-9-]{4,40}$/;

/** Indexes a collected paper's full text for retrieval. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Malformed workspace id." }, { status: 400 });
  }

  let sourceId: string;
  try {
    ({ sourceId } = (await request.json()) as { sourceId: string });
  } catch {
    return NextResponse.json({ error: "Body must be JSON with a sourceId." }, { status: 400 });
  }

  const workspace = await readWorkspace(id);
  const source = workspace.sources.find((item) => item.sourceId === sourceId);

  if (!source) {
    return NextResponse.json({ error: `No collected source ${sourceId}.` }, { status: 404 });
  }
  if (!source.passages?.length) {
    return NextResponse.json(
      { error: "That paper's full text has not been read yet." },
      { status: 409 },
    );
  }

  try {
    const chunks = await indexPaper(id, sourceId, source.title, source.passages);
    return NextResponse.json({ chunks, title: source.title });
  } catch (error) {
    console.error("[api/workspace/index-source]", error);
    return NextResponse.json({ error: "Could not index that paper." }, { status: 502 });
  }
}
