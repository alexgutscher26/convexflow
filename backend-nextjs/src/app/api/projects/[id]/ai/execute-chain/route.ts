import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { executeSinglePromptNode } from "@/lib/prompt-executor";
import { captureSnapshot } from "@/lib/snapshots";

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
    
    // 1. Fetch all Prompt Output nodes in this project
    const allNodes = await db.collection("nodes")
      .find({ project_id: projectId, type: "Prompt Output" })
      .toArray();
      
    if (allNodes.length === 0) {
      return NextResponse.json(
        { detail: "No 'Prompt Output' nodes found in this project canvas to chain." },
        { status: 400 }
      );
    }
    
    const nodeMap: Record<string, any> = {};
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    
    for (const n of allNodes) {
      nodeMap[n.id] = n;
      adj[n.id] = [];
      inDegree[n.id] = 0;
    }
    
    // 2. Fetch all edges in this project
    const allEdges = await db.collection("edges")
      .find({ project_id: projectId })
      .toArray();
      
    for (const e of allEdges) {
      const src = e.source_node_id;
      const tgt = e.target_node_id;
      if (nodeMap[src] && nodeMap[tgt]) {
        adj[src].push(tgt);
        inDegree[tgt] = (inDegree[tgt] || 0) + 1;
      }
    }
    
    // Topological sort (Kahn's)
    const queue = Object.keys(inDegree).filter(nid => inDegree[nid] === 0);
    const order: string[] = [];
    
    while (queue.length > 0) {
      queue.sort(); // Deterministic ordering
      const curr = queue.shift()!;
      order.push(curr);
      
      for (const neighbor of adj[curr]) {
        inDegree[neighbor] -= 1;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    if (order.length < allNodes.length) {
      return NextResponse.json(
        { detail: "Cycle detected in your Prompt Chain! Please ensure prompt nodes are connected in a directed acyclic flow (DAG)." },
        { status: 400 }
      );
    }
    
    // Execute sequentially
    const results: any[] = [];
    for (const nid of order) {
      const updatedNode = await executeSinglePromptNode(nid, user.id);
      results.push({
        id: nid,
        title: updatedNode.title || "Untitled",
        preview: (updatedNode.content || "").slice(0, 200),
      });
    }
    
    const nowStr = new Date().toISOString();
    
    // Capture snapshot of the executed state
    await captureSnapshot(
      projectId,
      "manual",
      "Prompt Chain Execution",
      {
        executed_nodes: results.map(r => r.id),
        execution_order: order,
      }
    );
    
    // Update project updated_at timestamp
    await db.collection("projects").updateOne(
      { id: projectId },
      { $set: { updated_at: nowStr } }
    );
    
    return NextResponse.json({
      ok: true,
      executed_order: order,
      nodes: results,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
