import { http } from "./http";

export interface Category {
  id: number;
  name: string;
  slug: string;
  path: string;
  parent_id: number | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  children?: Category[];
}

export interface CategoryCreatePayload {
  name: string;
  parent_id?: number | null;
}

export interface CategoryUpdatePayload {
  name?: string;
}

export interface CategoryMovePayload {
  new_parent_id?: number | null;
}

export interface CategoryReorderPayload {
  parent_id?: number | null;
  ordered_ids: number[];
}

export async function getCategoryTree(
  includeDeleted = false,
): Promise<Category[]> {
  const query = includeDeleted ? "?include_deleted=true" : "";
  return http<Category[]>(`/api/v1/categories/tree${query}`);
}

export async function createCategory(payload: CategoryCreatePayload) {
  return http<Category>("/api/v1/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(
  id: number,
  payload: CategoryUpdatePayload,
) {
  return http<Category>(`/api/v1/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: number) {
  return http<void>(`/api/v1/categories/${id}`, {
    method: "DELETE",
  });
}

export async function moveCategory(
  id: number,
  payload: CategoryMovePayload,
): Promise<Category> {
  return http<Category>(`/api/v1/categories/${id}/move`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function reorderCategories(payload: CategoryReorderPayload) {
  return http<Category[]>("/api/v1/categories/reorder", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
