import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { decryptPat } from "@/lib/fernet";
import { githubGet } from "../route";
import { v4 as uuidv4 } from "uuid";

interface FrameworkSignal {
  keys: Record<string, string>;
}

const FRAMEWORK_SIGNALS: Record<string, FrameworkSignal> = {
  "package.json": { keys: {
    "next": "Next.js", "react": "React", "vue": "Vue", "svelte": "Svelte",
    "express": "Express", "@nestjs/core": "NestJS", "prisma": "Prisma",
    "jest": "Jest", "playwright": "Playwright", "vitest": "Vitest",
    "tailwindcss": "Tailwind CSS", "@types/node": "Node.js",
  }},
  "requirements.txt": { keys: {
    "fastapi": "FastAPI", "flask": "Flask", "django": "Django",
    "sqlalchemy": "SQLAlchemy", "pytest": "PyTest", "motor": "Motor/MongoDB",
    "pymongo": "MongoDB",
  }},
  "pyproject.toml": { keys: {
    "fastapi": "FastAPI", "django": "Django", "poetry": "Poetry",
  }},
  "Dockerfile": { keys: { "dockerfile": "Docker" }},
  "docker-compose.yml": { keys: { "docker-compose": "Docker Compose" }},
  "next.config.js": { keys: { "next.config": "Next.js" }},
  "vite.config.js": { keys: { "vite": "Vite" }},
  "vite.config.ts": { keys: { "vite": "Vite" }},
  "tailwind.config.js": { keys: { "tailwind": "Tailwind CSS" }},
  "prisma/schema.prisma": { keys: { "prisma": "Prisma" }},
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert owner
    const project = await assertProjectOwner(projectId, user.id);
    const repo = project.repository;
    
    if (!repo) {
      return NextResponse.json({ detail: "No repository connected" }, { status: 400 });
    }
    
    const db = await getDb();
    
    // Fetch user document to get decrypted PAT
    const userDoc = await db.collection("users").findOne({ id: user.id });
    const pat = userDoc?.github_pat ? decryptPat(userDoc.github_pat) : "";
    
    const branch = repo.branch || "main";
    const owner = repo.owner;
    const repoName = repo.repo;
    
    // 1. Fetch recursive git tree
    let treeResp;
    try {
      treeResp = await githubGet(
        `https://api.github.com/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`,
        pat
      );
    } catch (gitErr: any) {
      return NextResponse.json(
        { detail: `Failed to fetch repository tree: ${gitErr.message}` },
        { status: gitErr.status || 502 }
      );
    }
    
    const rawTree = treeResp.tree || [];
    const fileTree = rawTree.slice(0, 2000).map((t: any) => ({
      path: t.path,
      type: t.type,
      size: t.size || 0,
    }));
    
    const pathsSet = new Set<string>(rawTree.map((t: any) => t.path));
    
    // 2. Framework detection
    const detectedFrameworks = new Set<string>();
    
    for (const [signalFile, cfg] of Object.entries(FRAMEWORK_SIGNALS)) {
      if (pathsSet.has(signalFile)) {
        if (signalFile === "Dockerfile" || signalFile === "docker-compose.yml") {
          Object.values(cfg.keys).forEach(val => detectedFrameworks.add(val));
          continue;
        }
        
        try {
          const contents = await githubGet(
            `https://api.github.com/repos/${owner}/${repoName}/contents/${signalFile}?ref=${branch}`,
            pat
          );
          
          if (contents && contents.content) {
            const raw = Buffer.from(contents.content, "base64")
              .toString("utf8")
              .toLowerCase();
              
            for (const [key, label] of Object.entries(cfg.keys)) {
              if (raw.includes(key)) {
                detectedFrameworks.add(label);
              }
            }
          }
        } catch {
          // Graceful ignore: skip if specific content file couldn't be loaded
        }
      }
    }
    
    // 3. Fetch README excerpt
    let readme = "";
    const readmeCandidates = ["README.md", "Readme.md", "readme.md"];
    for (const candidate of readmeCandidates) {
      if (pathsSet.has(candidate)) {
        try {
          const contents = await githubGet(
            `https://api.github.com/repos/${owner}/${repoName}/contents/${candidate}?ref=${branch}`,
            pat
          );
          if (contents && contents.content) {
            readme = Buffer.from(contents.content, "base64")
              .toString("utf8")
              .slice(0, 2500);
            break;
          }
        } catch {
          // Graceful ignore
        }
      }
    }
    
    // 4. Update repository document state
    const nowStr = new Date().toISOString();
    const updatedRepo = {
      ...repo,
      file_tree: fileTree,
      frameworks: Array.from(detectedFrameworks).sort(),
      readme_excerpt: readme,
      scanned_at: nowStr,
    };
    
    await db.collection("projects").updateOne(
      { id: projectId },
      { $set: { repository: updatedRepo, updated_at: nowStr } }
    );
    
    // 5. Audit stale node file references
    const newPaths = new Set<string>(
      rawTree.filter((t: any) => t.type === "blob").map((t: any) => t.path)
    );
    
    const staleNodesSummary: any[] = [];
    const nodesToCheck = await db.collection("nodes")
      .find({ project_id: projectId })
      .toArray();
      
    for (const n of nodesToCheck) {
      const refs = n.file_references || [];
      const metadata = n.metadata || {};
      
      if (refs.length === 0) {
        if (metadata.stale_file_references) {
          delete metadata.stale_file_references;
          metadata.last_rescan_at = nowStr;
          await db.collection("nodes").updateOne(
            { id: n.id },
            { $set: { metadata, updated_at: nowStr } }
          );
        }
        continue;
      }
      
      const stale = refs.filter((p: string) => !newPaths.has(p));
      metadata.last_rescan_at = nowStr;
      
      if (stale.length > 0) {
        metadata.stale_file_references = stale;
        staleNodesSummary.push({
          node_id: n.id,
          title: n.title || "(untitled)",
          type: n.type,
          stale_paths: stale,
        });
      } else {
        delete metadata.stale_file_references;
      }
      
      await db.collection("nodes").updateOne(
        { id: n.id },
        { $set: { metadata, updated_at: nowStr } }
      );
    }
    
    // 6. Upsert GitHub Context canvas node
    const ctxLines = [
      `## Repository\n\`${owner}/${repoName}\` · branch \`${branch}\``,
      "",
    ];
    
    const sortedFrameworks = Array.from(detectedFrameworks).sort();
    if (sortedFrameworks.length > 0) {
      ctxLines.push("## Detected stack");
      sortedFrameworks.forEach(f => ctxLines.push(`- ${f}`));
      ctxLines.push("");
    }
    
    ctxLines.push(`## File tree\n\`${fileTree.length}\` files indexed.`);
    
    if (readme) {
      ctxLines.push("");
      ctxLines.push("## README excerpt");
      ctxLines.push("```");
      ctxLines.push(readme.slice(0, 1500));
      ctxLines.push("```");
    }
    
    const ctxContent = ctxLines.join("\n");
    
    const existingCtxNode = await db.collection("nodes").findOne({
      project_id: projectId,
      type: "GitHub Context"
    });
    
    if (existingCtxNode) {
      await db.collection("nodes").updateOne(
        { id: existingCtxNode.id },
        { $set: { content: ctxContent, updated_at: nowStr } }
      );
    } else {
      const ctxNode = {
        id: uuidv4(),
        project_id: projectId,
        type: "GitHub Context",
        title: `${owner}/${repoName}`,
        content: ctxContent,
        position_x: -260,
        position_y: -120,
        metadata: { auto_generated: true },
        file_references: [],
        created_at: nowStr,
        updated_at: nowStr,
      };
      await db.collection("nodes").insertOne(ctxNode);
    }
    
    return NextResponse.json({
      ...updatedRepo,
      stale_summary: {
        count: staleNodesSummary.length,
        nodes: staleNodesSummary,
      },
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
