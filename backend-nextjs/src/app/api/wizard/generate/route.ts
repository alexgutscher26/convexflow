import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { buildWizardGraph } from "@/lib/wizard";
import { v4 as uuidv4 } from "uuid";

const WizardReqSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().default(""),
  project_kind: z.enum([
    "saas_app", "web_app", "api_service", "cli_tool", "mobile_app", "ai_ml"
  ]).default("saas_app"),
  stack: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  team_size: z.enum(["solo", "small", "large"]).default("solo"),
  ai_tools: z.array(z.string()).default([]),
  deployment: z.enum(["vercel", "aws", "docker", "fly", "railway", "none"]).default("vercel"),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const result = WizardReqSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const reqData = result.data;
    const db = await getDb();
    
    const projectId = uuidv4();
    const nowStr = new Date().toISOString();
    
    const projectDoc = {
      id: projectId,
      name: reqData.name,
      description: reqData.description,
      project_type: "greenfield",
      template: "wizard",
      owner_id: user.id,
      repository: null,
      wizard_answers: reqData,
      created_at: nowStr,
      updated_at: nowStr,
    };
    
    await db.collection("projects").insertOne(projectDoc);
    
    const graph = buildWizardGraph(reqData);
    const refToId: Record<string, string> = {};
    const nodeDocs = [];
    
    for (const n of graph.nodes) {
      const nid = uuidv4();
      refToId[n.ref] = nid;
      nodeDocs.push({
        id: nid,
        project_id: projectId,
        type: n.type,
        title: n.title,
        content: n.content,
        position_x: n.x,
        position_y: n.y,
        metadata: { from_wizard: true },
        file_references: [],
        created_at: nowStr,
        updated_at: nowStr,
      });
    }
    
    if (nodeDocs.length > 0) {
      await db.collection("nodes").insertMany(nodeDocs);
    }
    
    const edgeDocs = [];
    for (const e of graph.edges) {
      if (refToId[e.source] && refToId[e.target]) {
        edgeDocs.push({
          id: uuidv4(),
          project_id: projectId,
          source_node_id: refToId[e.source],
          target_node_id: refToId[e.target],
          relationship_type: e.relationship,
          created_at: nowStr,
        });
      }
    }
    
    if (edgeDocs.length > 0) {
      await db.collection("edges").insertMany(edgeDocs);
    }
    
    const { _id, ...safeProject } = projectDoc as any;
    return NextResponse.json(safeProject);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
