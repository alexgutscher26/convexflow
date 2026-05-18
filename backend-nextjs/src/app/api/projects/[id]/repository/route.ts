import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { encryptPat } from "@/lib/fernet";

const RepoConnectSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().optional().default("main"),
  pat: z.string().optional().default(""),
});

export async function githubGet(url: string, pat: string) {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "CortexFlow",
  };
  if (pat) {
    headers["Authorization"] = `Bearer ${pat}`;
  }
  
  const r = await fetch(url, { headers });
  if (r.status === 404) {
    throw { status: 404, message: "Repository or branch not found" };
  }
  if (r.status === 401) {
    throw { status: 401, message: "Invalid GitHub token" };
  }
  if (r.status === 403) {
    throw { status: 403, message: "GitHub rate limit or access denied" };
  }
  if (!r.ok) {
    const text = await r.text();
    throw { status: 502, message: `GitHub error: ${text.slice(0, 200)}` };
  }
  return r.json();
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
    const result = RepoConnectSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { owner, repo, branch, pat } = result.data;
    
    // Verify repository is accessible on GitHub
    let info;
    try {
      info = await githubGet(`https://api.github.com/repos/${owner}/${repo}`, pat);
    } catch (gitErr: any) {
      return NextResponse.json({ detail: gitErr.message || "Failed to reach GitHub" }, { status: gitErr.status || 502 });
    }
    
    const db = await getDb();
    const nowStr = new Date().toISOString();
    
    const repoDoc = {
      github_repo_id: String(info.id || ""),
      owner,
      repo,
      branch: branch || info.default_branch || "main",
      description: info.description || "",
      html_url: info.html_url,
      stars: info.stargazers_count || 0,
      language: info.language,
      pat_stored: !!pat,
      connected_at: nowStr,
      file_tree: [],
      frameworks: [],
      readme_excerpt: "",
    };
    
    // Store encrypted PAT in the user document if provided
    if (pat) {
      const encrypted = encryptPat(pat);
      await db.collection("users").updateOne(
        { id: user.id },
        { $set: { github_pat: encrypted } }
      );
    }
    
    // Connect repo to project
    await db.collection("projects").updateOne(
      { id: projectId },
      { $set: { repository: repoDoc, updated_at: nowStr } }
    );
    
    return NextResponse.json(repoDoc);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
