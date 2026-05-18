import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { sanitizeAndNormalizeText } from "@/lib/sanitize";
import { v4 as uuidv4 } from "uuid";

const NodeInSchema = z.object({
  type: z.string(),
  title: z.string().optional().default(""),
  content: z.string().optional().default(""),
  position_x: z.number().optional().default(0),
  position_y: z.number().optional().default(0),
  metadata: z.record(z.string(), z.any()).optional().default({}),
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
    const nodes = await db.collection("nodes")
      .find({ project_id: projectId }, { projection: { _id: 0 } })
      .toArray();
      
    return NextResponse.json(nodes);
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
    const result = NodeInSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    let { type, title, content, position_x, position_y, metadata } = result.data;
    
    // Sanitize title and content
    try {
      title = sanitizeAndNormalizeText(title, 120);
      content = sanitizeAndNormalizeText(content, 30000);
    } catch (sanErr: any) {
      return NextResponse.json({ detail: sanErr.message }, { status: 400 });
    }
    
    const db = await getDb();
    const nowStr = new Date().toISOString();
    const nodeId = uuidv4();
    
    const nodeDoc = {
      id: nodeId,
      project_id: projectId,
      type,
      title: title || type,
      content,
      position_x,
      position_y,
      metadata,
      file_references: [],
      created_at: nowStr,
      updated_at: nowStr,
    };
    
    await db.collection("nodes").insertOne(nodeDoc);
    
    // Update project updated_at
    await db.collection("projects").updateOne(
      { id: projectId },
      { $set: { updated_at: nowStr } }
    );
    
    const { _id, ...safeNode } = nodeDoc as any;
    return NextResponse.json(safeNode);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
