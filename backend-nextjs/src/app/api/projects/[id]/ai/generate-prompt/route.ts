import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { getCurrentUser, assertProjectOwner } from "@/lib/auth";
import { askLlm } from "@/lib/llm";
import { captureSnapshot } from "@/lib/snapshots";

const AIPromptSchema = z.object({
  template: z.enum([
    "feature_implementation", "refactor", "bug_fix", "testing",
    "migration", "architecture",
  ]).default("feature_implementation"),
  focus_node_ids: z.array(z.string()).default([]),
  extra_instructions: z.string().default(""),
  link_prior_prompts: z.boolean().default(true),
});

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

const TEMPLATE_BRIEFS: Record<string, string> = {
  feature_implementation: "Generate an implementation prompt for a new feature.",
  refactor: "Generate a prompt to refactor existing code safely.",
  bug_fix: "Generate a prompt to isolate and fix a bug.",
  testing: "Generate a prompt to create tests.",
  migration: "Generate a prompt for a framework/database migration.",
  architecture: "Generate an architecture-planning prompt.",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const user = await getCurrentUser(req);
    
    // Assert owner
    const project = await assertProjectOwner(projectId, user.id);
    const db = await getDb();
    
    const body = await req.json();
    const result = AIPromptSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const reqData = result.data;
    
    const nodes = await db.collection("nodes")
      .find({ project_id: projectId }, { projection: { _id: 0 } })
      .toArray();
      
    const edges = await db.collection("edges")
      .find({ project_id: projectId }, { projection: { _id: 0 } })
      .toArray();
      
    const byType: Record<string, any[]> = {};
    for (const n of nodes) {
      if (!byType[n.type]) byType[n.type] = [];
      byType[n.type].push(n);
    }
    
    const repo = project.repository || {};
    const frameworks = repo.frameworks || [];
    
    const fileRefsSet = new Set<string>();
    
    if (reqData.focus_node_ids.length > 0) {
      const focusSet = new Set(reqData.focus_node_ids);
      for (const n of nodes) {
        if (focusSet.has(n.id)) {
          (n.file_references || []).forEach((f: string) => fileRefsSet.add(f));
        }
      }
    } else {
      for (const n of nodes) {
        (n.file_references || []).forEach((f: string) => fileRefsSet.add(f));
      }
    }
    
    // Fetch 3 most recent prompt snapshots if linked
    const priorPrompts: any[] = [];
    if (reqData.link_prior_prompts) {
      const priorSnaps = await db.collection("snapshots")
        .find({ project_id: projectId, kind: "prompt" })
        .sort({ created_at: -1 })
        .limit(3)
        .toArray();
        
      for (const s of priorSnaps) {
        const meta = s.metadata || {};
        const text = meta.prompt_text || "";
        priorPrompts.push({
          label: s.label,
          template: meta.prompt_template,
          extra_instructions: meta.extra_instructions,
          created_at: s.created_at,
          prompt_excerpt: text.slice(0, 1500),
          prompt_truncated: text.length > 1500,
        });
      }
    }
    
    // Map Prompt Output nodes
    const savedPromptNodes = (byType["Prompt Output"] || []).map(n => ({
      title: n.title,
      content_excerpt: (n.content || "").slice(0, 1200),
    }));
    
    const nodesByTypeContext: Record<string, any[]> = {};
    for (const [type, items] of Object.entries(byType)) {
      if (type !== "Prompt Output") {
        nodesByTypeContext[type] = items.map(n => ({
          title: n.title,
          content: n.content,
        }));
      }
    }
    
    const context = {
      project: { name: project.name, description: project.description },
      stack: frameworks,
      repository: repo.owner ? {
        owner: repo.owner,
        repo: repo.repo,
        branch: repo.branch,
      } : null,
      referenced_files: Array.from(fileRefsSet).sort(),
      nodes_by_type: nodesByTypeContext,
      saved_prompt_nodes_on_canvas: savedPromptNodes,
      prior_prompts: priorPrompts,
      edge_count: edges.length,
    };
    
    const brief = TEMPLATE_BRIEFS[reqData.template] || TEMPLATE_BRIEFS.feature_implementation;
    
    const prompt = (
      `# Task\n${brief}\n\n` +
      `Output a single self-contained markdown prompt suitable for pasting ` +
      `into Cursor / GitHub Copilot Chat / Claude Code. Structure the ` +
      `output with these H2 sections in order:\n` +
      `## Objective\n## Repository Context\n## Constraints\n` +
      `## Required Deliverables\n## Validation Requirements\n## Output Format\n\n` +
      `Use the structured project graph below to ground every section.\n\n` +
      `## Extra user instructions\n${reqData.extra_instructions || "(none)"}\n\n` +
      `## Project graph (JSON)\n\`\`\`json\n${JSON.stringify(context, null, 2).slice(0, 12000)}\n\`\`\`\n` +
      `Return ONLY the final prompt markdown. No preamble.`
    );
    
    const reply = await askLlm(SYSTEM_MESSAGE, prompt);
    
    // Auto-snapshot: capture graph + generated prompt
    const labelStr = `Prompt · ${reqData.template.replace(/_/g, " ")}`;
    await captureSnapshot(projectId, "prompt", labelStr, {
      prompt_template: reqData.template,
      prompt_text: reply,
      extra_instructions: reqData.extra_instructions,
      focus_node_ids: reqData.focus_node_ids,
    });
    
    return NextResponse.json({
      prompt: reply,
      template: reqData.template,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status });
  }
}
