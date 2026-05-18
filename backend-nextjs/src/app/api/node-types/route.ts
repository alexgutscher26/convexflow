import { NextResponse } from "next/server";

const NODE_TYPE_LIST = [
  "Product Overview",
  "Feature Scope",
  "User Stories",
  "Technical Architecture",
  "Database Schema",
  "API Contracts",
  "UI Requirements",
  "Acceptance Criteria",
  "AI Coding Rules",
  "File References",
  "Deployment Requirements",
  "Testing Instructions",
  "GitHub Context",
  "Prompt Output",
];

export async function GET() {
  return NextResponse.json({ types: NODE_TYPE_LIST });
}
