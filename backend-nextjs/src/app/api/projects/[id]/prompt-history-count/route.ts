import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";

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
    
    const count = await db.collection("snapshots").countDocuments({
      project_id: projectId,
      kind: "prompt",
    });
    
    const saved = await db.collection("nodes").countDocuments({
      project_id: projectId,
      type: "Prompt Output",
    });
    
    return NextResponse.json({
      prior_prompts: count,
      saved_prompt_nodes: saved,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
