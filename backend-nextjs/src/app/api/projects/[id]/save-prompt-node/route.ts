import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

const SavePromptNodeSchema = z.object({
  content: z.string(),
  title: z.string().default("Generated Prompt"),
  position_x: z.number().default(0),
  position_y: z.number().default(0),
});

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
    const result = SavePromptNodeSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const reqData = result.data;
    const db = await getDb();
    const nowStr = new Date().toISOString();
    
    const nodeDoc = {
      id: uuidv4(),
      project_id: projectId,
      type: "Prompt Output",
      title: reqData.title,
      content: reqData.content,
      position_x: reqData.position_x,
      position_y: reqData.position_y,
      metadata: { generated: true },
      file_references: [],
      created_at: nowStr,
      updated_at: nowStr,
    };
    
    await db.collection("nodes").insertOne(nodeDoc);
    
    // Update project updated_at timestamp
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
