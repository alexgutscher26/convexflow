import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);
    const db = await getDb();

    const constraint = await db.collection("constraints").findOne({ id });
    if (!constraint) {
      return NextResponse.json({ detail: "Constraint not found" }, { status: 404 });
    }

    if (constraint.user_id !== user.id) {
      return NextResponse.json({ detail: "Forbidden" }, { status: 403 });
    }

    await db.collection("constraints").deleteOne({ id });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const status = err.message === "Unauthorized" || err.message === "Missing token" || err.message === "Invalid token" ? 401 : 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
