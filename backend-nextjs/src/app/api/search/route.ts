import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

function makeSnippet(text: string, query: string, length = 200): string {
  if (!text) return "";
  if (!query) {
    return text.length > length ? text.slice(0, length) + "..." : text;
  }
  
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return text.length > length ? text.slice(0, length) + "..." : text;
  }
  
  let start = Math.max(0, idx - Math.floor(length / 2));
  const end = Math.min(text.length, start + length);
  
  if (start > 0) {
    const spaceIdx = text.indexOf(" ", start);
    if (spaceIdx !== -1 && spaceIdx < idx) {
      start = spaceIdx + 1;
    }
  }
  
  let snippet = text.slice(start, end);
  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < text.length) {
    snippet = snippet + "...";
  }
  return snippet;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    
    const memBefore = process.memoryUsage().rss;
    const t0 = performance.now();
    
    const db = await getDb();
    
    // 1. Fetch user's projects
    const userProjects = await db.collection("projects")
      .find({ owner_id: user.id }, { projection: { _id: 0, id: 1, name: 1 } })
      .toArray();
      
    const userProjectIds = userProjects.map(p => p.id);
    const projectNameMap: Record<string, string> = {};
    userProjects.forEach(p => {
      projectNameMap[p.id] = p.name || "Unknown Project";
    });
    
    const results: any[] = [];
    
    if (userProjectIds.length === 0) {
      const t1 = performance.now();
      const latencyMs = t1 - t0;
      const memAfter = process.memoryUsage().rss;
      return NextResponse.json({
        results: [],
        metrics: {
          query_latency_ms: latencyMs,
          indexing_time_ms: 0,
          memory_usage_bytes: Math.max(0, memAfter - memBefore),
        },
        debug_logs: ["User has no projects. Search query ignored."],
      });
    }
    
    if (q.trim()) {
      // Parallel text search using MongoDB $text index
      const projectsPromise = db.collection("projects")
        .find(
          { owner_id: user.id, $text: { $search: q } },
          {
            projection: {
              _id: 0,
              id: 1,
              name: 1,
              description: 1,
              project_type: 1,
              template: 1,
              score: { $meta: "textScore" },
            },
          }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(100)
        .toArray();
        
      const nodesPromise = db.collection("nodes")
        .find(
          { project_id: { $in: userProjectIds }, $text: { $search: q } },
          {
            projection: {
              _id: 0,
              id: 1,
              project_id: 1,
              title: 1,
              content: 1,
              type: 1,
              metadata: 1,
              score: { $meta: "textScore" },
            },
          }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(500)
        .toArray();
        
      const [rawProjects, rawNodes] = await Promise.all([projectsPromise, nodesPromise]);
      
      // Format project results
      for (const p of rawProjects) {
        results.push({
          type: "project",
          id: p.id,
          title: p.name,
          snippet: makeSnippet(p.description || "", q),
          score: p.score || 0.0,
          metadata: {
            project_type: p.project_type,
            template: p.template,
          },
        });
      }
      
      // Format node results
      for (const n of rawNodes) {
        results.push({
          type: "node",
          id: n.id,
          project_id: n.project_id,
          project_name: projectNameMap[n.project_id] || "Unknown Project",
          title: n.title || n.type || "Untitled Node",
          snippet: makeSnippet(n.content || "", q),
          score: n.score || 0.0,
          metadata: {
            node_type: n.type,
            metadata: n.metadata,
          },
        });
      }
    } else {
      // Fallback for empty query: return latest projects and nodes
      const projectsPromise = db.collection("projects")
        .find({ owner_id: user.id }, { projection: { _id: 0 } })
        .sort({ updated_at: -1 })
        .limit(10)
        .toArray();
        
      const nodesPromise = db.collection("nodes")
        .find({ project_id: { $in: userProjectIds } }, { projection: { _id: 0 } })
        .sort({ updated_at: -1 })
        .limit(20)
        .toArray();
        
      const [rawProjects, rawNodes] = await Promise.all([projectsPromise, nodesPromise]);
      
      for (const p of rawProjects) {
        results.push({
          type: "project",
          id: p.id,
          title: p.name,
          snippet: (p.description || "").slice(0, 200),
          score: 0.0,
          metadata: {
            project_type: p.project_type,
            template: p.template,
          },
        });
      }
      
      for (const n of rawNodes) {
        results.push({
          type: "node",
          id: n.id,
          project_id: n.project_id,
          project_name: projectNameMap[n.project_id] || "Unknown Project",
          title: n.title || n.type || "Untitled Node",
          snippet: (n.content || "").slice(0, 200),
          score: 0.0,
          metadata: {
            node_type: n.type,
            metadata: n.metadata,
          },
        });
      }
    }
    
    // Sort combined results by score descending
    results.sort((a, b) => b.score - a.score);
    
    const t1 = performance.now();
    const latencyMs = t1 - t0;
    const memAfter = process.memoryUsage().rss;
    const memUsageBytes = Math.max(0, memAfter - memBefore);
    
    const debugLogs = [
      `Search query received: ${JSON.stringify(q)}`,
      `Target workspace (user_id): ${user.id}`,
      `Associated project count: ${userProjectIds.length}`,
      `Database indexes utilized: ['projects_text_index', 'nodes_text_index']`,
      `Unified score-sorted search results count: ${results.length}`,
      `Query latency: ${latencyMs.toFixed(2)}ms`,
      `Memory utilization change: ${memUsageBytes} bytes`,
    ];
    
    return NextResponse.json({
      results,
      metrics: {
        query_latency_ms: latencyMs,
        indexing_time_ms: 0,
        memory_usage_bytes: memUsageBytes,
      },
      debug_logs: debugLogs,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
