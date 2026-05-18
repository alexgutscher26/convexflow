import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/templates";
import { v4 as uuidv4 } from "uuid";

const ProjectCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().default(""),
  project_type: z.enum(["greenfield", "existing", "feature"]).default("greenfield"),
  template: z.string().default("blank"),
});

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const db = await getDb();
    
    const items = await db.collection("projects")
      .find({ owner_id: user.id }, { projection: { _id: 0 } })
      .sort({ updated_at: -1 })
      .limit(200)
      .toArray();
      
    return NextResponse.json(items);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const result = ProjectCreateSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { name, description, project_type, template } = result.data;
    const db = await getDb();
    
    const projectId = uuidv4();
    const nowStr = new Date().toISOString();
    
    const projectDoc = {
      id: projectId,
      name,
      description,
      project_type,
      template,
      owner_id: user.id,
      repository: null,
      created_at: nowStr,
      updated_at: nowStr,
    };
    
    await db.collection("projects").insertOne(projectDoc);
    
    // Seed graph from template if template is not blank
    const tmpl = TEMPLATES[template];
    if (tmpl) {
      const refToId: Record<string, string> = {};
      const nodeDocs = [];
      
      for (const n of tmpl.nodes) {
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
          metadata: { from_template: template },
          file_references: [],
          created_at: nowStr,
          updated_at: nowStr,
        });
      }
      
      if (nodeDocs.length > 0) {
        await db.collection("nodes").insertMany(nodeDocs);
      }
      
      const edgeDocs = [];
      for (const e of tmpl.edges) {
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
    }
    
    // Remove MongoDB _id before returning
    const { _id, ...safeProject } = projectDoc as any;
    
    return NextResponse.json(safeProject);
  } catch (err: any) {
    const status = err.message === "Unauthorized" || err.message === "Missing token" || err.message === "Invalid token" ? 401 : 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
