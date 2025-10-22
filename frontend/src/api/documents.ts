import { buildQuery, http } from "./http";

export interface Document {
  id: number;
  title: string;
  type?: string;
  position: number;
  content?: Record<string, unknown>;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  metadata: Record<string, unknown>;
}

export interface DocumentCreatePayload {
  title: string;
  type?: string;
  position?: number;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
}

export interface DocumentUpdatePayload {
  title?: string;
  type?: string;
  position?: number;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
}

export interface DocumentsPage {
  page: number;
  size: number;
  total: number;
  items: Document[];
}

export interface DocumentListParams {
  page?: number;
  size?: number;
  query?: string;
  type?: string;
  include_deleted?: boolean;
  include_descendants?: boolean;
  metadata?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  tags?: string[];
}

export interface DocumentReorderPayload {
  node_id: number;
  ordered_ids: number[];
}

function buildDocumentQuery(params?: DocumentListParams): string {
  if (!params) return "";
  const flatParams: Record<string, unknown> = {};
  const { metadata, tags, ...rest } = params;
  Object.assign(flatParams, rest);

  if (tags && tags.length > 0) {
    flatParams.tags = tags;
  }

  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      flatParams[`metadata.${key}`] = value;
    });
  }
  return buildQuery(flatParams);
}

export async function getDocuments(params?: DocumentListParams): Promise<DocumentsPage> {
  const query = buildDocumentQuery(params);
  return http<DocumentsPage>(`/api/v1/documents${query}`);
}

export async function getNodeDocuments(
  nodeId: number,
  params?: DocumentListParams,
): Promise<Document[]> {
  const query = buildDocumentQuery(params);
  return http<Document[]>(`/api/v1/nodes/${nodeId}/subtree-documents${query}`);
}

export async function createDocument(payload: DocumentCreatePayload): Promise<Document> {
  return http<Document>("/api/v1/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDocument(docId: number, payload: DocumentUpdatePayload): Promise<Document> {
  return http<Document>(`/api/v1/documents/${docId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function reorderDocuments(payload: DocumentReorderPayload): Promise<Document[]> {
  return http<Document[]>("/api/v1/documents/reorder", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function bindDocument(nodeId: number, docId: number): Promise<void> {
  await http<void>(`/api/v1/nodes/${nodeId}/bind/${docId}`, {
    method: "POST",
  });
}
