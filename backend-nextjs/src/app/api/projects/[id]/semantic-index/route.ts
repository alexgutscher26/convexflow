import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { decryptPat } from "@/lib/fernet";
import { githubGet } from "../repository/route";
import { getEmbedding } from "@/lib/embeddings";
import { v4 as uuidv4 } from "uuid";

// Whitelisted extensions that are meaningful for semantic search
const INDEXABLE_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".rs", ".java", ".c", ".cpp",
  ".h", ".cs", ".rb", ".php", ".html", ".css", ".md", ".json", ".yaml", ".yml",
  ".toml", ".prisma", ".sh", ".sql", ".dockerfile", "dockerfile"
];

function isIndexable(path: string): boolean {
  const low = path.toLowerCase();
  
  // Exclude common noise directories and lockfiles
  if (
    low.includes("node_modules") ||
    low.includes(".git") ||
    low.includes(".next") ||
    low.includes("package-lock.json") ||
    low.includes("yarn.lock") ||
    low.includes("pnpm-lock.yaml") ||
    low.includes(".temp") ||
    low.includes("dist") ||
    low.includes("build")
  ) {
    return false;
  }

  // Check extensions
  return INDEXABLE_EXTENSIONS.some(ext => low.endsWith(ext) || low.split("/").pop() === ext);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert owner
    const project = await assertProjectOwner(projectId, user.id);
    const db = await getDb();
    
    const repo = project.repository;
    const nowStr = new Date().toISOString();

    // 1. Index Canvas Nodes
    const nodes = await db.collection("nodes")
      .find({ project_id: projectId })
      .toArray();

    let nodesIndexed = 0;
    for (const n of nodes) {
      // Build a descriptive text representation of the node
      const nodeText = `[${n.type}] Title: ${n.title || "(Untitled)"}\nContent:\n${n.content || ""}`;
      try {
        const embedding = await getEmbedding(nodeText);
        await db.collection("nodes").updateOne(
          { id: n.id },
          { $set: { embedding, updated_at: nowStr } }
        );
        nodesIndexed++;
      } catch (err) {
        console.error(`Failed to index node ${n.id}:`, err);
      }
    }

    // 2. Index Repository Codebase Files (if repo connected)
    let filesIndexed = 0;
    let errorsList: string[] = [];

    if (repo && repo.file_tree && Array.isArray(repo.file_tree) && repo.file_tree.length > 0) {
      // Fetch user document to get decrypted PAT
      const userDoc = await db.collection("users").findOne({ id: user.id });
      const pat = userDoc?.github_pat ? decryptPat(userDoc.github_pat) : "";
      
      const owner = repo.owner;
      const repoName = repo.repo;
      const branch = repo.branch || "main";

      // Clear previous file embeddings for this project
      await db.collection("code_embeddings").deleteMany({ project_id: projectId });

      // Filter and score files to index up to 80 primary codebase files
      const eligibleFiles = repo.file_tree
        .filter((f: any) => f.type === "blob" && isIndexable(f.path))
        .slice(0, 80);

      for (const f of eligibleFiles) {
        try {
          // Fetch file content from GitHub
          const contents = await githubGet(
            `https://api.github.com/repos/${owner}/${repoName}/contents/${f.path}?ref=${branch}`,
            pat
          );

          if (contents && contents.content) {
            const rawContent = Buffer.from(contents.content, "base64")
              .toString("utf8");
              
            const excerpt = rawContent.slice(0, 1000); // 1K character excerpt for context suggestions
            const fileText = `File Path: ${f.path}\nContent:\n${rawContent.slice(0, 4000)}`;
            const embedding = await getEmbedding(fileText);

            const doc = {
              id: uuidv4(),
              project_id: projectId,
              path: f.path,
              size: f.size || 0,
              embedding,
              excerpt,
              updated_at: nowStr,
            };

            await db.collection("code_embeddings").insertOne(doc);
            filesIndexed++;
          }
        } catch (err: any) {
          errorsList.push(`${f.path}: ${err.message || err}`);
          // Proceed with next files gracefully
        }
      }
    }

    // Update project state with the last indexing stamp
    const updatedRepository = repo ? {
      ...repo,
      semantic_indexed_at: nowStr,
    } : null;

    await db.collection("projects").updateOne(
      { id: projectId },
      { $set: { repository: updatedRepository, updated_at: nowStr } }
    );

    return NextResponse.json({
      success: true,
      nodes_indexed: nodesIndexed,
      files_indexed: filesIndexed,
      errors: errorsList.slice(0, 5), // return up to 5 sample errors
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
