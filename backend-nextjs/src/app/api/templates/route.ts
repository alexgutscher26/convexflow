import { NextResponse } from "next/server";
import { TEMPLATE_META } from "@/lib/templates";

export async function GET() {
  const templates = [
    { id: "blank", label: "Blank", description: "Empty canvas — build from scratch." },
    ...TEMPLATE_META,
  ];
  return NextResponse.json({ templates });
}
