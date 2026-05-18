import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { getEmbedding, cosineSimilarity } from "@/lib/embeddings";

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

    const { searchParams } = new URL(req.url);
    const nodeId = searchParams.get("node_id") || "";
    const limit = parseInt(searchParams.get("limit") || "4", 10);

    if (!nodeId) {
      return NextResponse.json({ detail: "Missing node_id parameter" }, { status: 400 });
    }

    // 1. Fetch selected node
    const node = await db.collection("nodes").findOne({ id: nodeId, project_id: projectId });
    if (!node) {
      return NextResponse.json({ detail: "Node not found" }, { status: 404 });
    }

    let nodeVector = node.embedding;

    // Dynamically generate embedding if missing (to ensure instant user feedback)
    if (!nodeVector || !Array.isArray(nodeVector) || nodeVector.length === 0) {
      const nodeText = `[${node.type}] Title: ${node.title || "(Untitled)"}\nContent:\n${node.content || ""}`;
      try {
        nodeVector = await getEmbedding(nodeText);
        // Save dynamically
        await db.collection("nodes").updateOne(
          { id: nodeId },
          { $set: { embedding: nodeVector, updated_at: new Date().toISOString() } }
        );
      } catch (err) {
        console.error("Failed to generate node embedding on the fly:", err);
      }
    }

    if (!nodeVector || nodeVector.length === 0) {
      return NextResponse.json({ nodes: [], files: [] });
    }

    // 2. Query other nodes and calculate cosine similarity
    const otherNodes = await db.collection("nodes")
      .find({ project_id: projectId, id: { $ne: nodeId }, embedding: { $exists: true } })
      .toArray();

    const nodeSuggestions = otherNodes
      .map(n => {
        const similarity = cosineSimilarity(nodeVector, n.embedding || []);
        return {
          id: n.id,
          title: n.title || "(untitled)",
          type: n.type,
          similarity,
        };
      })
      .filter(n => n.similarity > 0.15) // exclude very weak matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // 3. Query codebase files and calculate cosine similarity
    const codeFiles = await db.collection("code_embeddings")
      .find({ project_id: projectId })
      .toArray();

    const fileSuggestions = codeFiles
      .map(f => {
        const similarity = cosineSimilarity(nodeVector, f.embedding || []);
        return {
          path: f.path,
          size: f.size || 0,
          similarity,
        };
      })
      .filter(f => f.similarity > 0.15) // exclude very weak matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return NextResponse.json({
      nodes: nodeSuggestions,
      files: fileSuggestions,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
