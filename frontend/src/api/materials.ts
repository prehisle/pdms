import { buildQuery, http } from "./http";

// Material types
export type MaterialType = "question" | "overview" | "dictation" | "reference";

export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "multi_blank_choice"
  | "fill_blank"
  | "essay";

// Question option
export interface QuestionOption {
  label: string;
  content: string;
  is_correct?: boolean;
}

// Blank configuration
export interface BlankConfig {
  index: number;
  acceptable_answers: string[];
}

// Material metadata
export interface MaterialMetadata {
  resource_type: MaterialType;
  question_type?: QuestionType;
  difficulty?: number;
  tags?: string[];
  options?: QuestionOption[];
  blanks?: BlankConfig[];
  answer?: unknown;
  analysis?: string;
}

// Material document
export interface Material {
  id: number;
  title: string;
  type?: string;
  position: number;
  content?: Record<string, unknown>;
  metadata: MaterialMetadata;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// Create payload
export interface MaterialCreatePayload {
  title: string;
  metadata: MaterialMetadata;
  content?: Record<string, unknown>;
}

// Update payload
export interface MaterialUpdatePayload {
  title?: string;
  metadata?: Partial<MaterialMetadata>;
  content?: Record<string, unknown>;
}

// List params
export interface MaterialListParams {
  page?: number;
  size?: number;
  resource_type?: MaterialType;
  question_type?: QuestionType;
  tags?: string[];
}

// Materials page
export interface MaterialsPage {
  page: number;
  size: number;
  total: number;
  items: Material[];
}

// API functions
export async function getMaterials(
  params?: MaterialListParams,
): Promise<MaterialsPage> {
  const query = buildQuery((params ?? {}) as Record<string, unknown>);
  return http<MaterialsPage>(`/api/v1/materials${query}`);
}

export async function getMaterial(id: number): Promise<Material> {
  return http<Material>(`/api/v1/materials/${id}`);
}

export async function createMaterial(
  payload: MaterialCreatePayload,
): Promise<Material> {
  return http<Material>("/api/v1/materials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateMaterial(
  id: number,
  payload: MaterialUpdatePayload,
): Promise<Material> {
  return http<Material>(`/api/v1/materials/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteMaterial(id: number): Promise<void> {
  return http<void>(`/api/v1/materials/${id}`, {
    method: "DELETE",
  });
}
