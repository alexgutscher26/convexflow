import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

const EdgeInSchema = z.object({
  source_node_id: z.string(),
  target_node_id: z.string(),
  relationship_type: z.enum([
    "depends_on", "constrains", "implements", "references", "produces"
  ]).default("depends_on"),
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
    const edges = await db.collection("edges")
      .find({ project_id: projectId }, { projection: { _id: 0 } })
      .toArray();
      
    return NextResponse.json(edges);
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
    const result = EdgeInSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { source_node_id, target_node_id, relationship_type } = result.data;
    const db = await getDb();
    
    // Verify source and target nodes exist and belong to this project
    const sourceNode = await db.collection("nodes").findOne({ id: source_node_id, project_id: projectId });
    const targetNode = await db.collection("nodes").findOne({ id: target_node_id, project_id: projectId });
    
    if (!sourceNode || !targetNode) {
      return NextResponse.json(
        { detail: "Source or target node not found in this project" },
        { status: 400 }
      );
    }
    
    const edgeId = uuidv4();
    const nowStr = new Date().toISOString();
    
    const edgeDoc = {
      id: edgeId,
      project_id: projectId,
      source_node_id,
      target_node_id,
      relationship_type,
      created_at: nowStr,
    };
    
    await db.collection("edges").insertOne(edgeDoc);
    
    const { _id, ...safeEdge } = edgeDoc as any;
    return NextResponse.json(safeEdge);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
