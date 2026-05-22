import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { decryptPat } from "@/lib/fernet";
import { githubGet } from "../route";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json({ detail: "Path parameter is required" }, { status: 400 });
    }

    const user = await getCurrentUser(req);
    const project = await assertProjectOwner(projectId, user.id);
    const repo = project.repository;

    if (!repo) {
      return NextResponse.json({ detail: "No repository connected" }, { status: 400 });
    }

    const db = await getDb();
    const userDoc = await db.collection("users").findOne({ id: user.id });
    const pat = userDoc?.github_pat ? decryptPat(userDoc.github_pat) : "";

    const branch = repo.branch || "main";
    const owner = repo.owner;
    const repoName = repo.repo;

    // Fetch file content from GitHub API
    // Ensure we handle URL encoding of the path parameter
    const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
    const contents = await githubGet(
      `https://api.github.com/repos/${owner}/${repoName}/contents/${encodedPath}?ref=${branch}`,
      pat
    );

    if (contents.type !== "file") {
      return NextResponse.json({ detail: "Target path is not a file" }, { status: 400 });
    }

    // Decode the base64 content
    const content = Buffer.from(contents.content, "base64").toString("utf8");

    return NextResponse.json({ content, path });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json(
      { detail: err.message || "Internal server error" },
      { status }
    );
  }
}
