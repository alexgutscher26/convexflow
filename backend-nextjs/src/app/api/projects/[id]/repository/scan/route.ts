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
    
    // 6. Parse project dependencies to construct Technical Architecture
    const depFiles = fileTree.filter((f: any) => {
      if (f.type !== "blob") return false;
      const parts = f.path.split("/");
      if (parts.length > 4) return false; // Max 3 directories deep + filename
      const filename = parts[parts.length - 1];
      return ["package.json", "pyproject.toml", "requirements.txt", "Cargo.toml", "go.mod"].includes(filename);
    });

    const parsedDeps: Record<string, { name: string; version: string; info?: string }[]> = {};
    const inferredArchitectures: Set<string> = new Set();

    for (const file of depFiles) {
      try {
        const contents = await githubGet(
          `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(file.path).replace(/%2F/g, "/")}/?ref=${branch}`,
          pat
        );
        if (contents && contents.content) {
          const raw = Buffer.from(contents.content, "base64").toString("utf8");
          const filename = file.path.split("/").pop() || "";
          
          if (filename === "package.json") {
            const pkg = JSON.parse(raw);
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            const list: any[] = [];
            for (const [name, ver] of Object.entries(deps)) {
              const cleanVer = String(ver);
              const desc = getPackageDescription(name);
              if (desc) inferredArchitectures.add(desc.pattern);
              list.push({ name, version: cleanVer, info: desc?.info || "" });
            }
            parsedDeps[file.path] = list;
          } else if (filename === "requirements.txt") {
            const list: any[] = [];
            const lines = raw.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#")) continue;
              const match = trimmed.match(/^([a-zA-Z0-9_\-\[\]]+)(==|>=|<=|~=|!=|>|<)?(.*)$/);
              if (match) {
                const name = match[1];
                const version = match[3] || "any";
                const desc = getPackageDescription(name.toLowerCase());
                if (desc) inferredArchitectures.add(desc.pattern);
                list.push({ name, version, info: desc?.info || "" });
              }
            }
            parsedDeps[file.path] = list;
          } else if (filename === "pyproject.toml") {
            const list: any[] = [];
            let inDependenciesSection = false;
            const lines = raw.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("[")) {
                if (trimmed.includes("dependencies")) {
                  inDependenciesSection = true;
                } else {
                  inDependenciesSection = false;
                }
                continue;
              }
              if (inDependenciesSection && trimmed && !trimmed.startsWith("#")) {
                const match = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*(.*)$/);
                if (match) {
                  const name = match[1];
                  const version = match[2].replace(/['"]/g, "");
                  const desc = getPackageDescription(name.toLowerCase());
                  if (desc) inferredArchitectures.add(desc.pattern);
                  list.push({ name, version, info: desc?.info || "" });
                }
              }
            }
            parsedDeps[file.path] = list;
          } else if (filename === "Cargo.toml") {
            const list: any[] = [];
            let inDependenciesSection = false;
            const lines = raw.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("[")) {
                if (trimmed.startsWith("[dependencies") || trimmed.startsWith("[dev-dependencies")) {
                  inDependenciesSection = true;
                } else {
                  inDependenciesSection = false;
                }
                continue;
              }
              if (inDependenciesSection && trimmed && !trimmed.startsWith("#")) {
                const match = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*(.*)$/);
                if (match) {
                  const name = match[1];
                  const version = match[2].replace(/['"]/g, "");
                  const desc = getPackageDescription(name.toLowerCase());
                  if (desc) inferredArchitectures.add(desc.pattern);
                  list.push({ name, version, info: desc?.info || "" });
                }
              }
            }
            parsedDeps[file.path] = list;
          } else if (filename === "go.mod") {
            const list: any[] = [];
            const lines = raw.split(/\r?\n/);
            let inRequire = false;
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("require (")) {
                inRequire = true;
                continue;
              }
              if (inRequire && trimmed === ")") {
                inRequire = false;
                continue;
              }
              if (trimmed.startsWith("require ") && !trimmed.includes("(")) {
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 3) {
                  const name = parts[1];
                  const version = parts[2];
                  const desc = getPackageDescription(name.toLowerCase());
                  if (desc) inferredArchitectures.add(desc.pattern);
                  list.push({ name, version, info: desc?.info || "" });
                }
              } else if (inRequire && trimmed) {
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2) {
                  const name = parts[0];
                  const version = parts[1];
                  const desc = getPackageDescription(name.toLowerCase());
                  if (desc) inferredArchitectures.add(desc.pattern);
                  list.push({ name, version, info: desc?.info || "" });
                }
              }
            }
            parsedDeps[file.path] = list;
          }
        }
      } catch (err) {
        console.error(`Error parsing dependency file ${file.path}:`, err);
      }
    }

    const archLines = [
      "# Technical Architecture",
      "",
      "Detected components, libraries, and inferred technical pattern details.",
      "",
    ];

    if (Object.keys(parsedDeps).length > 0) {
      archLines.push("## Dependency Scan Summary");
      archLines.push("");
      for (const [filePath, deps] of Object.entries(parsedDeps)) {
        archLines.push(`### \`${filePath}\``);
        if (deps.length === 0) {
          archLines.push("No major dependencies identified.");
        } else {
          const sorted = [...deps].sort((a, b) => a.name.localeCompare(b.name));
          sorted.forEach(d => {
            const verStr = d.version ? ` \`(${d.version})\`` : "";
            const infoStr = d.info ? ` · *${d.info}*` : "";
            archLines.push(`- **${d.name}**${verStr}${infoStr}`);
          });
        }
        archLines.push("");
      }
    }

    if (inferredArchitectures.size > 0) {
      archLines.push("## Inferred Architecture & Patterns");
      Array.from(inferredArchitectures).sort().forEach(p => {
        archLines.push(`- **${p}**`);
      });
      archLines.push("");
    }

    archLines.push(`*Last updated during repository scan at ${nowStr}*`);
    const archContent = archLines.join("\n");
    
    // 7. Upsert GitHub Context canvas node
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
    
    let ctxNodeId = existingCtxNode ? existingCtxNode.id : uuidv4();
    
    if (existingCtxNode) {
      await db.collection("nodes").updateOne(
        { id: existingCtxNode.id },
        { $set: { content: ctxContent, updated_at: nowStr } }
      );
    } else {
      const ctxNode = {
        id: ctxNodeId,
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

    // 8. Upsert Technical Architecture canvas node
    const existingArchNode = await db.collection("nodes").findOne({
      project_id: projectId,
      type: "Technical Architecture"
    });
    
    let archNodeId = existingArchNode ? existingArchNode.id : uuidv4();
    
    if (existingArchNode) {
      await db.collection("nodes").updateOne(
        { id: existingArchNode.id },
        { $set: { content: archContent, updated_at: nowStr } }
      );
    } else {
      const archNode = {
        id: archNodeId,
        project_id: projectId,
        type: "Technical Architecture",
        title: "Technical Architecture",
        content: archContent,
        position_x: -260,
        position_y: 200,
        metadata: { auto_generated: true },
        file_references: [],
        created_at: nowStr,
        updated_at: nowStr,
      };
      await db.collection("nodes").insertOne(archNode);
      
      // Also link GitHub Context -> Technical Architecture via edge
      const edgeId = uuidv4();
      await db.collection("edges").insertOne({
        id: edgeId,
        project_id: projectId,
        source_node_id: ctxNodeId,
        target_node_id: archNodeId,
        relationship_type: "context_to_architecture",
        created_at: nowStr,
      });
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

function getPackageDescription(name: string) {
  const mapping: Record<string, { info: string; pattern: string }> = {
    "next": { info: "Next.js Framework", pattern: "Next.js Web Application Architecture" },
    "react": { info: "React Library", pattern: "React Client-Side Component Model" },
    "vue": { info: "Vue Framework", pattern: "Vue Component Framework" },
    "svelte": { info: "Svelte Framework", pattern: "Svelte Compiled UI Components" },
    "express": { info: "Express.js", pattern: "Express Router & Middleware API Architecture" },
    "@nestjs/core": { info: "NestJS Framework", pattern: "NestJS Dependency Injection & Modular Backend" },
    "prisma": { info: "Prisma ORM", pattern: "Prisma ORM Database Layer" },
    "@prisma/client": { info: "Prisma Client", pattern: "Prisma ORM Database Layer" },
    "drizzle-orm": { info: "Drizzle ORM", pattern: "Drizzle ORM Type-Safe SQL Queries" },
    "mongodb": { info: "MongoDB Driver", pattern: "MongoDB Document Database Layer" },
    "mongoose": { info: "Mongoose ORM", pattern: "MongoDB Document Database Mapping" },
    "pg": { info: "PostgreSQL Client", pattern: "PostgreSQL Database Layer" },
    "postgres": { info: "PostgreSQL Client", pattern: "PostgreSQL Database Layer" },
    "graphql": { info: "GraphQL", pattern: "GraphQL API Layer" },
    "tailwindcss": { info: "Tailwind CSS", pattern: "Tailwind Utility-First Styling" },
    "typescript": { info: "TypeScript Compiler", pattern: "TypeScript Static Typing System" },
    "jest": { info: "Jest Test Runner", pattern: "Jest Unit/Integration Testing Suite" },
    "vitest": { info: "Vitest Test Runner", pattern: "Vitest Fast Testing Suite" },
    "playwright": { info: "Playwright E2E", pattern: "Playwright End-to-End Automation Testing" },
    "cypress": { info: "Cypress E2E", pattern: "Cypress Front-End Automation Testing" },
    "convex": { info: "Convex Client", pattern: "Convex Realtime DB & Sync Serverless Platform" },
    "convex-dev": { info: "Convex CLI", pattern: "Convex Realtime DB & Sync Serverless Platform" },
    
    // Python
    "fastapi": { info: "FastAPI", pattern: "FastAPI High Performance Web API Framework" },
    "django": { info: "Django Framework", pattern: "Django Model-Template-View Full-Stack Architecture" },
    "flask": { info: "Flask", pattern: "Flask Micro-Web API Framework" },
    "sqlalchemy": { info: "SQLAlchemy", pattern: "SQLAlchemy ORM & Database Toolkit" },
    "pytest": { info: "PyTest Suite", pattern: "PyTest Automated Python Testing" },
    
    // Rust
    "tokio": { info: "Tokio Runtime", pattern: "Tokio Async I/O Runtime Engine" },
    "axum": { info: "Axum Web", pattern: "Axum Route-Based Web Routing Framework" },
    "actix-web": { info: "Actix Web", pattern: "Actix Actor-Based Web Server Architecture" },
    "sqlx": { info: "SQLx Database", pattern: "SQLx Compile-Time Safe SQL Database Layer" },
    "diesel": { info: "Diesel ORM", pattern: "Diesel ORM Type-Safe Query Builder" },
    "serde": { info: "Serde Serializer", pattern: "Serde Data Serialization & Parsing Framework" }
  };
  return mapping[name] || null;
}

