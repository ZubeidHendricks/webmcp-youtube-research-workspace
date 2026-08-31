import { NextResponse } from "next/server";
import { mutateRoom, readRoom } from "@/lib/room/server";
import type { RoomOp } from "@/lib/room/types";

export const dynamic = "force-dynamic";

const ID_PATTERN = /^[a-z0-9-]{4,40}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Malformed room id." }, { status: 400 });
  }
  try {
    return NextResponse.json(await readRoom(id));
  } catch (error) {
    console.error("[api/room] read failed", error);
    return NextResponse.json({ error: "Could not read the room." }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Malformed room id." }, { status: 400 });
  }

  let op: RoomOp;
  try {
    op = (await request.json()) as RoomOp;
  } catch {
    return NextResponse.json({ error: "Body must be a JSON operation." }, { status: 400 });
  }
  if (!op || typeof op.type !== "string") {
    return NextResponse.json({ error: "Operation needs a type." }, { status: 400 });
  }

  try {
    return NextResponse.json(await mutateRoom(id, op));
  } catch (error) {
    console.error("[api/room] mutate failed", error);
    return NextResponse.json({ error: "Could not apply the change." }, { status: 503 });
  }
}
