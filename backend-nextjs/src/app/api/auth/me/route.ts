import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    return NextResponse.json(user);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Unauthorized" }, { status: 401 });
  }
}
