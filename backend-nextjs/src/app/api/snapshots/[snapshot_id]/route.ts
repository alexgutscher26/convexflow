import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ snapshot_id: string }> }
) {
  try {
    const { snapshot_id: snapshotId } = await params;
    const user = await getCurrentUser(req);
    const db = await getDb();
    
    const snap = await db.collection("snapshots").findOne({ id: snapshotId });
    if (!snap) {
      return NextResponse.json({ detail: "Snapshot not found" }, { status: 404 });
    }
    
    // Assert owner
    await assertProjectOwner(snap.project_id, user.id);
    
    const { _id, ...safeSnap } = snap as any;
    return NextResponse.json(safeSnap);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ snapshot_id: string }> }
) {
  try {
    const { snapshot_id: snapshotId } = await params;
    const user = await getCurrentUser(req);
    const db = await getDb();
    
    const snap = await db.collection("snapshots").findOne({ id: snapshotId });
    if (!snap) {
      return NextResponse.json({ detail: "Snapshot not found" }, { status: 404 });
    }
    
    // Assert owner
    await assertProjectOwner(snap.project_id, user.id);
    
    await db.collection("snapshots").deleteOne({ id: snapshotId });
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
