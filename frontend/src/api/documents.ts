import { buildQuery, http } from "./http";

// Document types
export const DOCUMENT_TYPES = {
  OVERVIEW: "overview",
  DICTATION: "dictation",
  COMPREHENSIVE_CHOICE: "comprehensive_choice",
  CASE_ANALYSIS: "case_analysis",
  ESSAY: "essay",
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

// Content formats
export const CONTENT_FORMATS = {
  HTML: "html",
  YAML: "yaml",
} as const;

export type ContentFormat = typeof CONTENT_FORMATS[keyof typeof CONTENT_FORMATS];

// Document content structure
export interface DocumentContent {
  format: ContentFormat;
  data: string;
}

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
  id?: number[];
  include_deleted?: boolean;
  include_descendants?: boolean;
  metadata?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  tags?: string[];
}

export interface DocumentReorderPayload {
  node_id: number;
  ordered_ids: number[];
}

export interface DocumentTrashParams {
  page?: number;
  size?: number;
  query?: string;
}

export interface DocumentTrashPage {
  page: number;
  size: number;
  total: number;
  items: Document[];
}

export interface DocumentVersion {
  document_id: number;
  version_number: number;
  title: string;
  type?: string;
  metadata?: Record<string, unknown>;
  content?: Record<string, unknown>;
  created_by: string;
  created_at: string;
  change_message?: string | null;
}

export interface DocumentVersionsPage {
  page: number;
  size: number;
  total: number;
  versions: DocumentVersion[];
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

export async function getDocumentDetail(docId: number): Promise<Document> {
  return http<Document>(`/api/v1/documents/${docId}`);
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

export async function deleteDocument(docId: number): Promise<void> {
  await http<void>(`/api/v1/documents/${docId}`, { method: "DELETE" });
}

export async function restoreDocument(docId: number): Promise<Document> {
  return http<Document>(`/api/v1/documents/${docId}/restore`, { method: "POST" });
}

export async function purgeDocument(docId: number): Promise<void> {
  await http<void>(`/api/v1/documents/${docId}/purge`, { method: "DELETE" });
}

export async function getDeletedDocuments(params?: DocumentTrashParams): Promise<DocumentTrashPage> {
  const query = buildQuery({
    page: params?.page,
    size: params?.size,
    query: params?.query,
  });
  return http<DocumentTrashPage>(`/api/v1/documents/trash${query}`);
}

export async function getDocumentVersions(
  docId: number,
  params?: { page?: number; size?: number },
): Promise<DocumentVersionsPage> {
  const query = buildQuery({
    page: params?.page,
    size: params?.size,
  });
  return http<DocumentVersionsPage>(`/api/v1/documents/${docId}/versions${query}`);
}

export async function restoreDocumentVersion(docId: number, versionNumber: number): Promise<Document> {
  return http<Document>(`/api/v1/documents/${docId}/versions/${versionNumber}/restore`, {
    method: "POST",
  });
}
