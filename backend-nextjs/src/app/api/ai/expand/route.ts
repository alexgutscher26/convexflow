import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { askLlm } from "@/lib/llm";

const AIExpandSchema = z.object({
  node_id: z.string().min(1),
  instruction: z.enum([
    "expand", "acceptance_criteria", "implementation_plan", "missing_constraints",
    "api_schema", "test_plan"
  ]).default("expand"),
});

const AI_INSTRUCTIONS: Record<string, string> = {
  expand: "Expand and enrich the content of this node. Write in concise, technical markdown. Add concrete details, constraints, and structured sub-sections.",
  acceptance_criteria: "Generate a comprehensive list of acceptance criteria as Given/When/Then bullets in markdown.",
  implementation_plan: "Generate a step-by-step implementation plan in markdown with file paths, code touchpoints, and validation checkpoints.",
  missing_constraints: "Detect and list missing technical constraints, edge cases, or architectural concerns for this node.",
  api_schema: "Suggest a concrete REST or GraphQL API schema relevant to this node in fenced code blocks.",
  test_plan: "Generate a structured test plan covering unit, integration, and e2e cases in markdown.",
};

const SYSTEM_MESSAGE = (
  "You are CortexFlow's architecture co-pilot. You help senior " +
  "engineers design AI-native software. Output crisp, technical " +
  "markdown. Avoid fluff and disclaimers. Use code fences for code.\n\n" +
  "When the user provides project context (graph nodes, prior " +
  "prompts, repository metadata), treat it as authoritative:\n" +
  "- Do not contradict decisions already encoded in the graph.\n" +
  "- Do not duplicate scope already covered by prior prompts.\n" +
  "- Cite node titles when referencing existing components.\n" +
  "- If extending a prior prompt, build on it explicitly; if " +
  "  overriding, call out the change."
);

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const result = AIExpandSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { node_id: nodeId, instruction: instKey } = result.data;
    const db = await getDb();
    
    // Find node
    const node = await db.collection("nodes").findOne({ id: nodeId });
    if (!node) {
      return NextResponse.json({ detail: "Node not found" }, { status: 404 });
    }
    
    // Assert owner
    const project = await assertProjectOwner(node.project_id, user.id);
    
    // Fetch parent/ancestor nodes (1 hop upstream)
    const incomingEdges = await db.collection("edges")
      .find({ target_node_id: nodeId })
      .toArray();
      
    const ancestorIds = incomingEdges.map(e => e.source_node_id);
    let ancestors: any[] = [];
    if (ancestorIds.length > 0) {
      ancestors = await db.collection("nodes")
        .find({ id: { $in: ancestorIds } })
        .toArray();
    }
    
    // Pull frameworks and coding rules
    const repo = project.repository || {};
    const rulesNodes = await db.collection("nodes")
      .find({ project_id: node.project_id, type: "AI Coding Rules" })
      .toArray();
      
    const instructionText = AI_INSTRUCTIONS[instKey] || AI_INSTRUCTIONS.expand;
    
    const ctxParts: string[] = [];
    if (repo.frameworks && repo.frameworks.length > 0) {
      ctxParts.push(`Detected stack: ${repo.frameworks.join(", ")}`);
    }
    if (rulesNodes.length > 0) {
      ctxParts.push("Project coding rules:");
      rulesNodes.forEach(r => {
        ctxParts.push((r.content || "").slice(0, 600));
      });
    }
    if (ancestors.length > 0) {
      ctxParts.push("Upstream nodes (use as authoritative context):");
      ancestors.forEach(a => {
        ctxParts.push(`### [${a.type}] ${a.title || ""}\n${(a.content || "").slice(0, 800)}`);
      });
    }
    
    const ctxBlock = ctxParts.length > 0 ? ctxParts.join("\n\n") : "(no additional context)";
    
    const prompt = (
      `# Task\n${instructionText}\n\n` +
      `# Node type\n${node.type}\n\n` +
      `# Node title\n${node.title || ""}\n\n` +
      `# Current content\n${node.content || "(empty)"}\n\n` +
      `# Project context\n${ctxBlock}\n\n` +
      `Return only the new markdown content. No preamble.`
    );
    
    const reply = await askLlm(SYSTEM_MESSAGE, prompt);
    
    return NextResponse.json({ content: reply });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
