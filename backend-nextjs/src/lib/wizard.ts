export interface WizardAnswers {
  name?: string;
  description?: string;
  project_kind?: string;
  stack?: string[];
  features?: string[];
  team_size?: string;
  ai_tools?: string[];
  deployment?: string;
}

export interface WizardNode {
  ref: string;
  type: string;
  title: string;
  x: number;
  y: number;
  content: string;
}

export interface WizardEdgeTuple {
  source: string;
  target: string;
  relationship: string;
}

export interface WizardGraphResult {
  nodes: WizardNode[];
  edges: WizardEdgeTuple[];
}

export function buildWizardGraph(answers: WizardAnswers): WizardGraphResult {
  const name = answers.name || "Project";
  const description = answers.description || "";
  const projectKind = answers.project_kind || "saas_app";
  const stack = answers.stack || [];
  const features = (answers.features || [])
    .map(f => f.trim())
    .filter(Boolean);
  const teamSize = answers.team_size || "solo";
  const aiTools = answers.ai_tools || [];
  const deployment = answers.deployment || "vercel";

  const stackStr = stack.length > 0 ? stack.join(", ") : "(not specified)";
  const aiToolsStr = aiTools.length > 0 ? aiTools.join(", ") : "(not specified)";

  const nodes: WizardNode[] = [];
  const edges: WizardEdgeTuple[] = [];

  // 1. Product Overview
  nodes.push({
    ref: "overview",
    type: "Product Overview",
    title: name,
    x: 0,
    y: 0,
    content: `## What we're building\n${description || "(describe your product)"}\n\n## Project kind\n\`${projectKind}\`\n\n## Team size\n${teamSize}\n\n## AI tooling in use\n${aiToolsStr}`,
  });

  // 2. Technical Architecture
  nodes.push({
    ref: "arch",
    type: "Technical Architecture",
    title: "Stack & layout",
    x: 320,
    y: -100,
    content: `## Stack\n${stackStr}\n\n## Components\n- (describe the layers here)\n\n## Data flow\nClient → API → DB`,
  });

  // 3. AI Coding Rules
  const rulesLines = [
    "## DO",
    "- Match the conventions of files already in the repository.",
    "- Write descriptive function names; prefer composition over inheritance.",
    "- Add types/schemas at every API boundary.",
    "",
    "## DO NOT",
    "- Invent new libraries when an existing one already covers it.",
    "- Re-implement abstractions that exist in the linked files.",
  ];

  const aiToolsSet = new Set(aiTools);
  if (aiToolsSet.has("Cursor") || aiToolsSet.has("Claude Code")) {
    rulesLines.push(
      "",
      "## Cursor / Claude Code specifics",
      "- Reference the linked files when implementing changes.",
      "- Use the project graph in the agent context pack as authoritative."
    );
  }
  if (aiToolsSet.has("Copilot")) {
    rulesLines.push(
      "",
      "## Copilot specifics",
      "- Prefer explicit imports over auto-suggested wildcards."
    );
  }
  if (aiToolsSet.has("Autonomous agents") || aiToolsSet.has("Devin")) {
    rulesLines.push(
      "",
      "## Autonomous agent specifics",
      "- After each task, run lint + tests; halt if either fails.",
      "- Open a PR rather than committing to main."
    );
  }

  nodes.push({
    ref: "rules",
    type: "AI Coding Rules",
    title: "Conventions",
    x: 320,
    y: 160,
    content: rulesLines.join("\n"),
  });

  // 4. Feature Scope
  const featureRefs: string[] = [];
  const topFeatures = features.slice(0, 4);

  for (let idx = 0; idx < topFeatures.length; idx++) {
    const feat = topFeatures[idx];
    const ref = `feature_${idx}`;
    featureRefs.push(ref);
    
    const x = 640 + (idx % 2) * 320;
    const y = -200 + Math.floor(idx / 2) * 240;
    
    nodes.push({
      ref,
      type: "Feature Scope",
      title: feat.slice(0, 80),
      x,
      y,
      content: `## Summary\n${feat}\n\n## Functional requirements\n- \n\n## Out of scope\n- `,
    });
  }

  if (featureRefs.length === 0) {
    nodes.push({
      ref: "feature_0",
      type: "Feature Scope",
      title: "First feature",
      x: 640,
      y: -200,
      content: "## Summary\n(describe the first feature)\n\n## Functional requirements\n- ",
    });
    featureRefs.push("feature_0");
  }

  // 5. DB Schema
  const hasDbImpl = stack.some(s =>
    ["postgres", "mongodb", "mysql", "prisma", "sqlalchemy", "drizzle"].includes(s.toLowerCase())
  );
  const needsDb = hasDbImpl || ["saas_app", "api_service", "mobile_app"].includes(projectKind);
  if (needsDb) {
    nodes.push({
      ref: "db",
      type: "Database Schema",
      title: "Core entities",
      x: 960,
      y: 80,
      content: "## Entities\n```\nUser { id, email, createdAt }\nResource { id, ownerId, ... }\n```\n\n## Relationships\n- User 1-N Resource",
    });
  }

  // 6. API Contracts
  const needsApi = ["saas_app", "api_service", "mobile_app", "web_app"].includes(projectKind);
  if (needsApi) {
    nodes.push({
      ref: "api",
      type: "API Contracts",
      title: "Endpoints",
      x: 1280,
      y: -80,
      content: "## Endpoints\n```\nGET    /api/resource\nPOST   /api/resource\nGET    /api/resource/{id}\n```\n\n## Auth\nJWT bearer token",
    });
  }

  // 7. UI Requirements
  const needsUi = ["saas_app", "web_app", "mobile_app"].includes(projectKind);
  if (needsUi) {
    nodes.push({
      ref: "ui",
      type: "UI Requirements",
      title: "Screens",
      x: 960,
      y: -320,
      content: "## Screens\n- \n\n## States\n- empty\n- loading\n- error\n- success",
    });
  }

  // 8. Acceptance Criteria
  const acceptRefs: [string, string][] = [];
  for (let i = 0; i < featureRefs.length; i++) {
    const fref = featureRefs[i];
    const ref = `accept_${i}`;
    acceptRefs.push([fref, ref]);
    
    const associatedNode = nodes.find(n => n.ref === fref);
    const associatedTitle = associatedNode ? associatedNode.title : "";
    
    nodes.push({
      ref,
      type: "Acceptance Criteria",
      title: `Acceptance · ${associatedTitle.slice(0, 40)}`,
      x: 1600,
      y: -200 + i * 180,
      content: "## Given\n## When\n## Then\n\n- [ ] criterion 1\n- [ ] criterion 2",
    });
  }

  // 9. Deployment Requirements
  const deploymentLabels: Record<string, string> = {
    vercel: "Vercel + managed Postgres",
    aws: "AWS (EC2 / RDS / S3)",
    docker: "Docker + self-host / k8s",
    fly: "Fly.io",
    railway: "Railway",
    none: "n/a",
  };
  const deploymentLabel = deploymentLabels[deployment] || deployment;
  
  if (deployment !== "none") {
    nodes.push({
      ref: "deploy",
      type: "Deployment Requirements",
      title: "Infra",
      x: 640,
      y: 420,
      content: `## Target\n${deploymentLabel}\n\n## Environments\n- preview · staging · production\n\n## Secrets\n- DATABASE_URL\n- JWT_SECRET`,
    });
  }

  // 10. Testing Instructions
  const testDepths: Record<string, string> = {
    solo: "Smoke-test the happy path. Skip exhaustive E2E.",
    small: "Unit-test critical paths; one E2E per top-level feature.",
    large: "Full test pyramid: unit + integration + E2E + load.",
  };
  const testDepth = testDepths[teamSize] || "Smoke-test the happy path.";
  
  nodes.push({
    ref: "test",
    type: "Testing Instructions",
    title: "QA",
    x: 1280,
    y: 280,
    content: `## Approach\n${testDepth}\n\n## Unit\n- \n\n## Integration\n- \n\n## E2E\n- `,
  });

  // ---------- edges ----------
  for (const fref of featureRefs) {
    edges.push({ source: "overview", target: fref, relationship: "depends_on" });
    edges.push({ source: "rules", target: fref, relationship: "constrains" });
  }

  edges.push({ source: "rules", target: "arch", relationship: "constrains" });

  for (const fref of featureRefs) {
    edges.push({ source: fref, target: "arch", relationship: "depends_on" });
  }

  if (needsDb) {
    edges.push({ source: "arch", target: "db", relationship: "implements" });
  }
  if (needsApi) {
    edges.push({ source: "arch", target: "api", relationship: "implements" });
    if (needsDb) {
      edges.push({ source: "api", target: "db", relationship: "depends_on" });
    }
  }
  if (needsUi) {
    edges.push({ source: "arch", target: "ui", relationship: "implements" });
  }

  for (const [fref, aref] of acceptRefs) {
    edges.push({ source: fref, target: aref, relationship: "produces" });
  }

  if (deployment !== "none") {
    edges.push({ source: "arch", target: "deploy", relationship: "depends_on" });
  }
  for (const fref of featureRefs) {
    edges.push({ source: fref, target: "test", relationship: "produces" });
  }

  return { nodes, edges };
}
