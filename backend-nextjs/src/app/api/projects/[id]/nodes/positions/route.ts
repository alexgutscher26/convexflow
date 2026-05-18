import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";

const PositionItemSchema = z.object({
  id: z.string(),
  position_x: z.number(),
  position_y: z.number(),
});

const BulkPositionsSchema = z.object({
  positions: z.array(PositionItemSchema),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert owner
    await assertProjectOwner(projectId, user.id);
    
    const body = await req.json();
    const result = BulkPositionsSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { positions } = result.data;
    if (!positions || positions.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }
    
    const db = await getDb();
    const nowStr = new Date().toISOString();
    
    // Construct bulk operations
    const operations = positions.map(item => ({
      updateOne: {
        filter: { id: item.id, project_id: projectId },
        update: {
          $set: {
            position_x: item.position_x,
            position_y: item.position_y,
            updated_at: nowStr,
          }
        }
      }
    }));
    
    const bulkResult = await db.collection("nodes").bulkWrite(operations);
    
    // Update project updated_at
    await db.collection("projects").updateOne(
      { id: projectId },
      { $set: { updated_at: nowStr } }
    );
    
    return NextResponse.json({
      ok: true,
      matched_count: bulkResult.matchedCount,
      modified_count: bulkResult.modifiedCount,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
