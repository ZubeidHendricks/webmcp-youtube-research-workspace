import { NextResponse } from "next/server";
import { mutateWorkspace, readWorkspace } from "@/lib/workspace/server";
import type { WorkspaceOp } from "@/lib/workspace/types";

export const dynamic = "force-dynamic";

const ID_PATTERN = /^[a-z0-9-]{4,40}$/;

function badId() {
  return NextResponse.json({ error: "Malformed workspace id." }, { status: 400 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return badId();

  try {
    return NextResponse.json(await readWorkspace(id));
  } catch (error) {
    console.error("[api/workspace] read failed", error);
    return NextResponse.json({ error: "Could not read the workspace." }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return badId();

  let op: WorkspaceOp;
  try {
    op = (await request.json()) as WorkspaceOp;
  } catch {
    return NextResponse.json({ error: "Body must be a JSON operation." }, { status: 400 });
  }

  if (!op || typeof op.type !== "string") {
    return NextResponse.json({ error: "Operation needs a type." }, { status: 400 });
  }

  try {
    return NextResponse.json(await mutateWorkspace(id, op));
  } catch (error) {
    console.error("[api/workspace] mutate failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not apply the change." },
      { status: 503 },
    );
  }
}
