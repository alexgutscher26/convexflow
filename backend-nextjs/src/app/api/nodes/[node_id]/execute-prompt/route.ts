import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { executeSinglePromptNode } from "@/lib/prompt-executor";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ node_id: string }> }
) {
  try {
    const { node_id: nodeId } = await params;
    const user = await getCurrentUser(req);
    
    const safeNode = await executeSinglePromptNode(nodeId, user.id);
    return NextResponse.json(safeNode);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
