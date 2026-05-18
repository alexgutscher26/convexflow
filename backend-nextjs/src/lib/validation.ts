export interface GraphNode {
  id: string;
  type: string;
  title?: string;
  content?: string;
  [key: string]: any;
}

export interface GraphEdge {
  id: string;
  project_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship_type?: string;
  [key: string]: any;
}

export interface ValidationIssue {
  node_id: string | null;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  suggestion: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  summary: {
    error_count: number;
    warning_count: number;
    info_count: number;
    total: number;
    ready_for_prompt: boolean;
  };
}

const GLOBAL_TYPES = new Set(["AI Coding Rules", "GitHub Context", "Prompt Output", "Product Overview"]);

export function validateGraph(nodes: GraphNode[], edges: GraphEdge[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  
  const nodesById: Record<string, GraphNode> = {};
  const nodesByType: Record<string, GraphNode[]> = {};
  
  for (const n of nodes) {
    nodesById[n.id] = n;
    if (!nodesByType[n.type]) {
      nodesByType[n.type] = [];
    }
    nodesByType[n.type].push(n);
  }

  const outEdges: Record<string, GraphEdge[]> = {};
  const inEdges: Record<string, GraphEdge[]> = {};
  
  for (const n of nodes) {
    outEdges[n.id] = [];
    inEdges[n.id] = [];
  }
  
  for (const e of edges) {
    if (outEdges[e.source_node_id]) {
      outEdges[e.source_node_id].push(e);
    }
    if (inEdges[e.target_node_id]) {
      inEdges[e.target_node_id].push(e);
    }
  }

  function add(
    severity: "error" | "warning" | "info",
    code: string,
    message: string,
    suggestion: string,
    nodeId: string | null = null
  ) {
    issues.push({
      node_id: nodeId,
      severity,
      code,
      message,
      suggestion,
    });
  }

  // 1. No Product Overview at all
  if (!nodesByType["Product Overview"] || nodesByType["Product Overview"].length === 0) {
    add(
      "error",
      "no_product_overview",
      "Project has no Product Overview node.",
      "Add a Product Overview node so prompts have a vision anchor."
    );
  }

  // 2. No AI Coding Rules
  if (!nodesByType["AI Coding Rules"] || nodesByType["AI Coding Rules"].length === 0) {
    add(
      "info",
      "no_coding_rules",
      "No AI Coding Rules node defined.",
      "Add coding conventions so generated prompts are constrained."
    );
  }

  // 3. Per-node checks
  for (const n of nodes) {
    const nid = n.id;
    const ntype = n.type;
    const content = (n.content || "").trim();

    // 3a. Empty / placeholder content
    if (content.length < 20) {
      add(
        "info",
        "empty_content",
        `${ntype} '${n.title || "untitled"}' has little or no content.`,
        "Fill in the node so prompts can ground decisions on it.",
        nid
      );
    }

    // 3b. Disconnected non-global nodes
    if (!GLOBAL_TYPES.has(ntype)) {
      const outCount = outEdges[nid]?.length || 0;
      const inCount = inEdges[nid]?.length || 0;
      if (outCount === 0 && inCount === 0) {
        add(
          "warning",
          "disconnected_node",
          `${ntype} '${n.title || "untitled"}' is disconnected.`,
          "Link it to upstream context or downstream consumers.",
          nid
        );
      }
    }

    // 3c. Feature Scope must have Acceptance Criteria downstream
    if (ntype === "Feature Scope") {
      const downstreamIds = new Set((outEdges[nid] || []).map(e => e.target_node_id));
      const downstreamTypes = new Set(
        Array.from(downstreamIds)
          .map(id => nodesById[id]?.type)
          .filter(Boolean)
      );
      
      if (!downstreamTypes.has("Acceptance Criteria")) {
        add(
          "warning",
          "feature_without_acceptance",
          `Feature '${n.title || "untitled"}' has no linked Acceptance Criteria.`,
          "Add an Acceptance Criteria node and connect this feature to it.",
          nid
        );
      }
      
      const upstreamIds = new Set((inEdges[nid] || []).map(e => e.source_node_id));
      const upstreamTypes = new Set(
        Array.from(upstreamIds)
          .map(id => nodesById[id]?.type)
          .filter(Boolean)
      );
      
      if (!downstreamTypes.has("Technical Architecture") && !upstreamTypes.has("Technical Architecture")) {
        add(
          "info",
          "feature_without_arch",
          `Feature '${n.title || "untitled"}' has no linked Technical Architecture.`,
          "Link to a Tech Architecture node so prompts know the stack.",
          nid
        );
      }
    }

    // 3d. API Contracts must link to Database Schema (either direction)
    if (ntype === "API Contracts") {
      const neighbourIds = new Set([
        ...(outEdges[nid] || []).map(e => e.target_node_id),
        ...(inEdges[nid] || []).map(e => e.source_node_id)
      ]);
      const neighbourTypes = new Set(
        Array.from(neighbourIds)
          .map(id => nodesById[id]?.type)
          .filter(Boolean)
      );
      
      if (!neighbourTypes.has("Database Schema")) {
        add(
          "warning",
          "api_without_schema",
          `API Contracts '${n.title || "untitled"}' has no linked Database Schema.`,
          "Connect to a DB Schema node so endpoint payloads match entities.",
          nid
        );
      }
    }

    // 3e. Database Schema with no API or UI consumer
    if (ntype === "Database Schema") {
      const neighbourIds = new Set([
        ...(outEdges[nid] || []).map(e => e.target_node_id),
        ...(inEdges[nid] || []).map(e => e.source_node_id)
      ]);
      const neighbourTypes = new Set(
        Array.from(neighbourIds)
          .map(id => nodesById[id]?.type)
          .filter(Boolean)
      );
      
      if (!neighbourTypes.has("API Contracts") && !neighbourTypes.has("UI Requirements")) {
        add(
          "info",
          "schema_without_consumer",
          `DB Schema '${n.title || "untitled"}' has no API or UI consumer.`,
          "Link to an API Contracts or UI Requirements node.",
          nid
        );
      }
    }

    // 3f. Acceptance Criteria orphan (no Feature Scope upstream)
    if (ntype === "Acceptance Criteria") {
      const upstreamTypes = new Set(
        (inEdges[nid] || [])
          .map(e => nodesById[e.source_node_id]?.type)
          .filter(Boolean)
      );
      
      if (!upstreamTypes.has("Feature Scope")) {
        add(
          "info",
          "acceptance_without_feature",
          `Acceptance Criteria '${n.title || "untitled"}' has no Feature Scope upstream.`,
          "Connect a Feature Scope node to this acceptance node.",
          nid
        );
      }
    }
  }

  // 4. Tech Architecture with no API or DB
  const archNodes = nodesByType["Technical Architecture"] || [];
  for (const arch of archNodes) {
    const nid = arch.id;
    const neighbourIds = new Set([
      ...(outEdges[nid] || []).map(e => e.target_node_id),
      ...(inEdges[nid] || []).map(e => e.source_node_id)
    ]);
    const neighbourTypes = new Set(
      Array.from(neighbourIds)
        .map(id => nodesById[id]?.type)
        .filter(Boolean)
    );
    
    if (!neighbourTypes.has("API Contracts") && !neighbourTypes.has("Database Schema")) {
      add(
        "info",
        "arch_without_impl",
        `Architecture '${arch.title || "untitled"}' has no API or DB linked.`,
        "Connect downstream API Contracts or DB Schema implementations.",
        nid
      );
    }
  }

  const counts = { error: 0, warning: 0, info: 0 };
  for (const i of issues) {
    counts[i.severity] = (counts[i.severity] || 0) + 1;
  }

  return {
    issues,
    summary: {
      error_count: counts.error,
      warning_count: counts.warning,
      info_count: counts.info,
      total: issues.length,
      ready_for_prompt: counts.error === 0,
    },
  };
}
