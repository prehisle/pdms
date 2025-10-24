import { buildQuery, http } from "./http";

// Relationship between node and material
export interface Relationship {
  node_id: number;
  document_id: number;
  created_by: string;
}

// List params
export interface RelationshipListParams {
  node_id?: number;
  document_id?: number;
}

// API functions
export async function listRelationships(
  params: RelationshipListParams,
): Promise<Relationship[]> {
  const query = buildQuery(params as Record<string, unknown>);
  return http<Relationship[]>(`/api/v1/relationships${query}`);
}

export async function bindRelationship(
  nodeId: number,
  documentId: number,
): Promise<Relationship> {
  const query = buildQuery({ node_id: nodeId, document_id: documentId } as Record<string, unknown>);
  return http<Relationship>(`/api/v1/relationships${query}`, {
    method: "POST",
  });
}

export async function unbindRelationship(
  nodeId: number,
  documentId: number,
): Promise<void> {
  const query = buildQuery({ node_id: nodeId, document_id: documentId } as Record<string, unknown>);
  return http<void>(`/api/v1/relationships${query}`, {
    method: "DELETE",
  });
}

// Get all materials bound to a node
export async function getNodeMaterials(nodeId: number): Promise<Relationship[]> {
  return listRelationships({ node_id: nodeId });
}

// Get all nodes bound to a material
export async function getMaterialNodes(materialId: number): Promise<Relationship[]> {
  return listRelationships({ document_id: materialId });
}
