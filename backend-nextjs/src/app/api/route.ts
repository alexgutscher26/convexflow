import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ service: "cortexflow", ok: true });
}
