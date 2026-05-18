import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { diffGraphs } from "@/lib/snapshots";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ snapshot_id: string; b_id: string }> }
) {
  try {
    const { snapshot_id: aId, b_id: bId } = await params;
    const user = await getCurrentUser(req);
    const db = await getDb();
    
    const a = await db.collection("snapshots").findOne({ id: aId });
    const b = await db.collection("snapshots").findOne({ id: bId });
    
    if (!a || !b) {
      return NextResponse.json({ detail: "Snapshot not found" }, { status: 404 });
    }
    
    if (a.project_id !== b.project_id) {
      return NextResponse.json({ detail: "Snapshots from different projects" }, { status: 400 });
    }
    
    // Assert owner
    await assertProjectOwner(a.project_id, user.id);
    
    const diff = diffGraphs(
      a.nodes_data || [],
      a.edges_data || [],
      b.nodes_data || [],
      b.edges_data || []
    );
    
    return NextResponse.json({
      before: { id: a.id, label: a.label, kind: a.kind, created_at: a.created_at },
      after: { id: b.id, label: b.label, kind: b.kind, created_at: b.created_at },
      diff,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
