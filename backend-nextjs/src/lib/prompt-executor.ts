import { getDb } from "./mongodb";
import { assertProjectOwner } from "./auth";
import { askLlm } from "./llm";

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

export async function executeSinglePromptNode(nodeId: string, userId: string) {
  const db = await getDb();
  
  // Find node
  const node = await db.collection("nodes").findOne({ id: nodeId });
  if (!node) {
    throw { status: 404, message: "Node not found" };
  }
  
  // Assert owner
  const project = await assertProjectOwner(node.project_id, userId);
  
  let promptText = node.metadata?.prompt || "";
  if (!promptText) {
    promptText = node.content || "";
  }
  
  // Fetch immediate upstream nodes
  const incomingEdges = await db.collection("edges")
    .find({ target_node_id: nodeId })
    .toArray();
    
  const sourceIds = incomingEdges.map(e => e.source_node_id);
  let upstreamNodes: any[] = [];
  if (sourceIds.length > 0) {
    upstreamNodes = await db.collection("nodes")
      .find({ id: { $in: sourceIds } })
      .toArray();
  }
  
  const upstreamBlocks = upstreamNodes.map(u => {
    const utype = u.type || "Unknown";
    const utitle = u.title || "Untitled";
    const ucontent = u.content || "";
    return `### Upstream Node: [${utype}] "${utitle}"\n${ucontent}`;
  });
  
  const upstreamContext = upstreamBlocks.length > 0 ? upstreamBlocks.join("\n\n") : "(None)";
  
  // Stacks & Coding rules
  const repo = project.repository || {};
  const frameworks = repo.frameworks || [];
  const rulesNodes = await db.collection("nodes")
    .find({ project_id: node.project_id, type: "AI Coding Rules" })
    .toArray();
    
  const generalContext: string[] = [];
  if (frameworks.length > 0) {
    generalContext.push(`Detected stack: ${frameworks.join(", ")}`);
  }
  if (rulesNodes.length > 0) {
    const rulesText = rulesNodes.map(r => r.content || "").join("\n");
    generalContext.push(`Coding Rules:\n${rulesText}`);
  }
  
  const genCtxStr = generalContext.join("\n\n");
  
  let fullPrompt = (
    `# Task / Instruction\n${promptText}\n\n` +
    `# Upstream Context (Authoritative inputs this node references/depends on)\n` +
    `${upstreamContext}\n\n`
  );
  if (genCtxStr) {
    fullPrompt += `# General Coding Conventions\n${genCtxStr}\n\n`;
  }
  fullPrompt += "Return only the final generated markdown content for this node's output. Do not include any intro, outro, preamble, or wrapper. Just start with the markdown response.";
  
  const reply = await askLlm(SYSTEM_MESSAGE, fullPrompt);
  
  const nowStr = new Date().toISOString();
  const updatedMetadata = {
    ...(node.metadata || {}),
    prompt: promptText,
    executed: true,
    executed_at: nowStr,
  };
  
  await db.collection("nodes").updateOne(
    { id: nodeId },
    {
      $set: {
        content: reply,
        metadata: updatedMetadata,
        updated_at: nowStr,
      },
    }
  );
  
  const updatedNode = {
    ...node,
    content: reply,
    metadata: updatedMetadata,
    updated_at: nowStr,
  };
  
  const { _id, ...safeNode } = updatedNode as any;
  return safeNode;
}
export { SYSTEM_MESSAGE };
