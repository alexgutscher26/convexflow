import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_CONSTRAINTS = [
  { text: "Always use server components unless state is required", category: "Next.js" },
  { text: "Keep all components functional with hooks", category: "React" },
  { text: "Always specify return types for API handlers", category: "TypeScript" },
  { text: "Use responsive styling with mobile-first media queries", category: "Styling" },
  { text: "Document every exported function/type with JSDoc", category: "Documentation" },
  { text: "Write unit tests for utility functions", category: "Testing" }
];

const ConstraintCreateSchema = z.object({
  text: z.string().min(1).max(500),
  category: z.string().min(1).max(50),
});

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const db = await getDb();

    let items: any[] = await db.collection("constraints")
      .find({ user_id: user.id }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .toArray();

    if (items.length === 0) {
      const nowStr = new Date().toISOString();
      const seedDocs = DEFAULT_CONSTRAINTS.map(c => ({
        id: uuidv4(),
        text: c.text,
        category: c.category,
        user_id: user.id,
        created_at: nowStr
      }));

      await db.collection("constraints").insertMany(seedDocs as any);
      
      items = seedDocs.map(({ ...rest }) => rest);
    }

    return NextResponse.json(items);
  } catch (err: any) {
    const status = err.message === "Unauthorized" || err.message === "Missing token" || err.message === "Invalid token" ? 401 : 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const db = await getDb();
    
    const body = await req.json();
    const result = ConstraintCreateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }

    const { text, category } = result.data;
    const constraintId = uuidv4();
    const nowStr = new Date().toISOString();

    const constraintDoc = {
      id: constraintId,
      text: text.trim(),
      category: category.trim(),
      user_id: user.id,
      created_at: nowStr,
    };

    await db.collection("constraints").insertOne(constraintDoc as any);

    const { _id, ...safeConstraint } = constraintDoc as any;
    return NextResponse.json(safeConstraint);
  } catch (err: any) {
    const status = err.message === "Unauthorized" || err.message === "Missing token" || err.message === "Invalid token" ? 401 : 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
