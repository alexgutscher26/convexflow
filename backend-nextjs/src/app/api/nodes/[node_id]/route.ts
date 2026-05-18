import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { sanitizeAndNormalizeText } from "@/lib/sanitize";

const NodeUpdateSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  file_references: z.array(z.string()).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ node_id: string }> }
) {
  try {
    const { node_id: nodeId } = await params;
    const user = await getCurrentUser(req);
    const db = await getDb();
    
    const node = await db.collection("nodes").findOne({ id: nodeId });
    if (!node) {
      return NextResponse.json({ detail: "Node not found" }, { status: 404 });
    }
    
    // Assert project owner
    await assertProjectOwner(node.project_id, user.id);
    
    const body = await req.json();
    const result = NodeUpdateSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const patch: Record<string, any> = {};
    const data = result.data;
    
    if (data.title !== undefined) {
      try {
        patch.title = sanitizeAndNormalizeText(data.title, 120);
      } catch (err: any) {
        return NextResponse.json({ detail: err.message }, { status: 400 });
      }
    }
    
    if (data.content !== undefined) {
      try {
        patch.content = sanitizeAndNormalizeText(data.content, 30000);
      } catch (err: any) {
        return NextResponse.json({ detail: err.message }, { status: 400 });
      }
    }
    
    if (data.position_x !== undefined) patch.position_x = data.position_x;
    if (data.position_y !== undefined) patch.position_y = data.position_y;
    if (data.metadata !== undefined) patch.metadata = data.metadata;
    if (data.file_references !== undefined) patch.file_references = data.file_references;
    
    const nowStr = new Date().toISOString();
    patch.updated_at = nowStr;
    
    await db.collection("nodes").updateOne(
      { id: nodeId },
      { $set: patch }
    );
    
    await db.collection("projects").updateOne(
      { id: node.project_id },
      { $set: { updated_at: nowStr } }
    );
    
    const updatedNode = await db.collection("nodes").findOne(
      { id: nodeId },
      { projection: { _id: 0 } }
    );
    
    return NextResponse.json(updatedNode);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ node_id: string }> }
) {
  try {
    const { node_id: nodeId } = await params;
    const user = await getCurrentUser(req);
    const db = await getDb();
    
    const node = await db.collection("nodes").findOne({ id: nodeId });
    if (!node) {
      return NextResponse.json({ detail: "Node not found" }, { status: 404 });
    }
    
    // Assert owner
    await assertProjectOwner(node.project_id, user.id);
    
    await db.collection("nodes").deleteOne({ id: nodeId });
    
    // Cascade delete any edges that reference this node
    await db.collection("edges").deleteMany({
      $or: [
        { source_node_id: nodeId },
        { target_node_id: nodeId }
      ]
    });
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
