import { getDb } from "./mongodb";
import { v4 as uuidv4 } from "uuid";

export interface SnapshotDoc {
  id: string;
  project_id: string;
  kind: "manual" | "prompt" | "export";
  label: string;
  created_at: string;
  nodes_data: any[];
  edges_data: any[];
  metadata: Record<string, any>;
}

export async function captureSnapshot(
  projectId: string,
  kind: "manual" | "prompt" | "export",
  label: string,
  metadata: Record<string, any> = {}
): Promise<SnapshotDoc> {
  const db = await getDb();
  
  const nodes = await db.collection("nodes")
    .find({ project_id: projectId }, { projection: { _id: 0 } })
    .toArray();
    
  const edges = await db.collection("edges")
    .find({ project_id: projectId }, { projection: { _id: 0 } })
    .toArray();
    
  const nowStr = new Date().toISOString();
  
  const snapDoc: SnapshotDoc = {
    id: uuidv4(),
    project_id: projectId,
    kind,
    label,
    created_at: nowStr,
    nodes_data: nodes,
    edges_data: edges,
    metadata: {
      ...metadata,
      _nodes_count: nodes.length,
      _edges_count: edges.length,
    },
  };
  
  await db.collection("snapshots").insertOne(snapDoc);
  
  const { _id, ...safeSnap } = snapDoc as any;
  return safeSnap;
}

export function summarizeSnapshot(snap: any) {
  return {
    id: snap.id,
    project_id: snap.project_id,
    kind: snap.kind,
    label: snap.label,
    created_at: snap.created_at,
    nodes_count: snap.nodes_count !== undefined ? snap.nodes_count : (snap.metadata?._nodes_count || snap.nodes_data?.length || 0),
    edges_count: snap.edges_count !== undefined ? snap.edges_count : (snap.metadata?._edges_count || snap.edges_data?.length || 0),
    metadata: snap.metadata || {},
  };
}

export interface GraphDiffResult {
  added_nodes: any[];
  removed_nodes: any[];
  modified_nodes: any[];
  added_edges: any[];
  removed_edges: any[];
  summary: {
    nodes_added: number;
    nodes_removed: number;
    nodes_modified: number;
    edges_added: number;
    edges_removed: number;
  };
}

export function diffGraphs(
  aNodes: any[],
  aEdges: any[],
  bNodes: any[],
  bEdges: any[]
): GraphDiffResult {
  const aNodeIdx: Record<string, any> = {};
  const bNodeIdx: Record<string, any> = {};
  
  for (const n of aNodes) aNodeIdx[n.id] = n;
  for (const n of bNodes) bNodeIdx[n.id] = n;
  
  const addedNodes = Object.keys(bNodeIdx)
    .filter(id => !aNodeIdx[id])
    .map(id => bNodeIdx[id]);
    
  const removedNodes = Object.keys(aNodeIdx)
    .filter(id => !bNodeIdx[id])
    .map(id => aNodeIdx[id]);
    
  const modifiedNodes: any[] = [];
  
  const commonIds = Object.keys(aNodeIdx).filter(id => bNodeIdx[id]);
  
  for (const nid of commonIds) {
    const aN = aNodeIdx[nid];
    const bN = bNodeIdx[nid];
    const changedFields: string[] = [];
    
    for (const f of ["type", "title", "content"]) {
      if ((aN[f] || "") !== (bN[f] || "")) {
        changedFields.push(f);
      }
    }
    
    const refA = new Set<string>(aN.file_references || []);
    const refB = new Set<string>(bN.file_references || []);
    
    let refsChanged = refA.size !== refB.size;
    if (!refsChanged) {
      for (const item of refA) {
        if (!refB.has(item)) {
          refsChanged = true;
          break;
        }
      }
    }
    
    if (refsChanged) {
      changedFields.push("file_references");
    }
    
    if (changedFields.length > 0) {
      modifiedNodes.push({
        id: nid,
        type: bN.type,
        title_before: aN.title,
        title_after: bN.title,
        content_before: aN.content || "",
        content_after: bN.content || "",
        file_references_before: Array.from(refA).sort(),
        file_references_after: Array.from(refB).sort(),
        changed_fields: changedFields,
      });
    }
  }

  function getEdgeKey(e: any): string {
    return `${e.source_node_id}|${e.target_node_id}|${e.relationship_type || "depends_on"}`;
  }
  
  const aEdgeKeys: Record<string, any> = {};
  const bEdgeKeys: Record<string, any> = {};
  
  for (const e of aEdges) aEdgeKeys[getEdgeKey(e)] = e;
  for (const e of bEdges) bEdgeKeys[getEdgeKey(e)] = e;
  
  const addedEdges = Object.keys(bEdgeKeys)
    .filter(k => !aEdgeKeys[k])
    .map(k => bEdgeKeys[k]);
    
  const removedEdges = Object.keys(aEdgeKeys)
    .filter(k => !bEdgeKeys[k])
    .map(k => aEdgeKeys[k]);
    
  return {
    added_nodes: addedNodes,
    removed_nodes: removedNodes,
    modified_nodes: modifiedNodes,
    added_edges: addedEdges,
    removed_edges: removedEdges,
    summary: {
      nodes_added: addedNodes.length,
      nodes_removed: removedNodes.length,
      nodes_modified: modifiedNodes.length,
      edges_added: addedEdges.length,
      edges_removed: removedEdges.length,
    },
  };
}
