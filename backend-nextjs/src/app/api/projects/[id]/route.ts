import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";

const ProjectUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().optional(),
  project_type: z.enum(["greenfield", "existing", "feature"]).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert owner verifies the project ownership and returns the doc
    const project = await assertProjectOwner(projectId, user.id);
    return NextResponse.json(project);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert project ownership
    await assertProjectOwner(projectId, user.id);
    
    const body = await req.json();
    const result = ProjectUpdateSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const db = await getDb();
    const patch: Record<string, any> = {};
    const data = result.data;
    
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.project_type !== undefined) patch.project_type = data.project_type;
    
    patch.updated_at = new Date().toISOString();
    
    await db.collection("projects").updateOne(
      { id: projectId },
      { $set: patch }
    );
    
    const updatedProject = await db.collection("projects").findOne(
      { id: projectId },
      { projection: { _id: 0 } }
    );
    
    return NextResponse.json(updatedProject);
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert project ownership
    await assertProjectOwner(projectId, user.id);
    
    const db = await getDb();
    
    // Cascade delete project and all dependent items
    await db.collection("projects").deleteOne({ id: projectId });
    await db.collection("nodes").deleteMany({ project_id: projectId });
    await db.collection("edges").deleteMany({ project_id: projectId });
    await db.collection("snapshots").deleteMany({ project_id: projectId });
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
