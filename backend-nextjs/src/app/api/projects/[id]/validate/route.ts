import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { validateGraph } from "@/lib/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert owner
    await assertProjectOwner(projectId, user.id);
    
    const db = await getDb();
    
    const nodes = await db.collection("nodes")
      .find({ project_id: projectId }, { projection: { _id: 0 } })
      .toArray();
      
    const edges = await db.collection("edges")
      .find({ project_id: projectId }, { projection: { _id: 0 } })
      .toArray();
      
    // Cast elements as GraphNode/GraphEdge array (implicitly matched)
    const result = validateGraph(nodes as any, edges as any);
    
    return NextResponse.json(result);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
