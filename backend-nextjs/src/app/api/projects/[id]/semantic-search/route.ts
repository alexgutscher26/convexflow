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
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "5", 10);

    if (!query.trim()) {
      return NextResponse.json({ nodes: [], files: [] });
    }

    // 1. Generate query embedding
    const queryVector = await getEmbedding(query);

    // 2. Query canvas nodes and calculate cosine similarity
    const nodes = await db.collection("nodes")
      .find({ project_id: projectId, embedding: { $exists: true } })
      .toArray();

    const nodeResults = nodes
      .map(n => {
        const similarity = cosineSimilarity(queryVector, n.embedding || []);
        return {
          id: n.id,
          title: n.title || "(untitled)",
          type: n.type,
          content: n.content || "",
          similarity,
        };
      })
      .filter(n => n.similarity > 0.1) // minimal filter
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // 3. Query codebase files and calculate cosine similarity
    const codeFiles = await db.collection("code_embeddings")
      .find({ project_id: projectId })
      .toArray();

    const fileResults = codeFiles
      .map(f => {
        const similarity = cosineSimilarity(queryVector, f.embedding || []);
        return {
          path: f.path,
          size: f.size || 0,
          excerpt: f.excerpt || "",
          similarity,
        };
      })
      .filter(f => f.similarity > 0.1) // minimal filter
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return NextResponse.json({
      nodes: nodeResults,
      files: fileResults,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
