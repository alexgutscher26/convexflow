import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ edge_id: string }> }
) {
  try {
    const { edge_id: edgeId } = await params;
    const user = await getCurrentUser(req);
    const db = await getDb();
    
    const edge = await db.collection("edges").findOne({ id: edgeId });
    if (!edge) {
      return NextResponse.json({ detail: "Edge not found" }, { status: 404 });
    }
    
    // Assert owner
    await assertProjectOwner(edge.project_id, user.id);
    
    await db.collection("edges").deleteOne({ id: edgeId });
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
