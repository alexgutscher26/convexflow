import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { captureSnapshot, summarizeSnapshot } from "@/lib/snapshots";

const SnapshotCreateSchema = z.object({
  label: z.string().min(1).max(120),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert owner
    await assertProjectOwner(projectId, user.id);
    
    const db = await getDb();
    
    const items = await db.collection("snapshots")
      .find(
        { project_id: projectId },
        { projection: { _id: 0, nodes_data: 0, edges_data: 0 } }
      )
      .sort({ created_at: -1 })
      .limit(500)
      .toArray();
      
    const summarized = items.map((item: any) => {
      const metadata = item.metadata || {};
      return {
        ...summarizeSnapshot(item),
        nodes_count: metadata._nodes_count || 0,
        edges_count: metadata._edges_count || 0,
      };
    });
    
    return NextResponse.json(summarized);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert owner
    await assertProjectOwner(projectId, user.id);
    
    const body = await req.json();
    const result = SnapshotCreateSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { label } = result.data;
    
    const snap = await captureSnapshot(projectId, "manual", label, {});
    
    return NextResponse.json(summarizeSnapshot(snap));
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
