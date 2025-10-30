import { http } from "./http";

/**
 * API Key 信息
 */
export interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  user_id: number;
  user?: {
    id: number;
    username: string;
    display_name?: string;
    role: string;
  };
  scopes?: string;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by_id: number;
  created_by?: {
    id: number;
    username: string;
    display_name?: string;
  };
}

/**
 * 创建 API Key 请求
 */
export interface CreateAPIKeyRequest {
  name: string;
  user_id: number;
  environment: "dev" | "test" | "prod";
  expires_at?: string; // ISO 8601 格式
}

/**
 * 创建 API Key 响应
 */
export interface CreateAPIKeyResponse {
  api_key: string; // 完整的 API Key，仅此时返回
  key_prefix: string;
  key_info: APIKey;
}

/**
 * API Key 列表响应
 */
export interface ListAPIKeysResponse {
  api_keys: APIKey[];
  total: number;
}

/**
 * API Key 统计信息
 */
export interface APIKeyStats {
  total: number;
  active: number;
  expired: number;
  revoked: number;
}

/**
 * 更新 API Key 请求
 */
export interface UpdateAPIKeyRequest {
  name?: string;
  expires_at?: string | null;
}

/**
 * 获取 API Key 列表
 */
export async function listAPIKeys(params?: {
  user_id?: number;
  include_deleted?: boolean;
}): Promise<ListAPIKeysResponse> {
  const searchParams = new URLSearchParams();
  if (params?.user_id) {
    searchParams.append("user_id", params.user_id.toString());
  }
  if (params?.include_deleted) {
    searchParams.append("include_deleted", "true");
  }

  const url = `/api/v1/api-keys${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return http<ListAPIKeysResponse>(url);
}

/**
 * 获取单个 API Key 详情
 */
export async function getAPIKey(id: number): Promise<APIKey> {
  return http<APIKey>(`/api/v1/api-keys/${id}`);
}

/**
 * 创建 API Key（仅超级管理员）
 */
export async function createAPIKey(
  data: CreateAPIKeyRequest,
): Promise<CreateAPIKeyResponse> {
  return http<CreateAPIKeyResponse>("/api/v1/api-keys", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 更新 API Key 信息
 */
export async function updateAPIKey(
  id: number,
  data: UpdateAPIKeyRequest,
): Promise<APIKey> {
  return http<APIKey>(`/api/v1/api-keys/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * 撤销 API Key（软删除）
 */
export async function revokeAPIKey(id: number): Promise<{ message: string }> {
  return http<{ message: string }>(`/api/v1/api-keys/${id}/revoke`, {
    method: "POST",
  });
}

/**
 * 永久删除 API Key（仅超级管理员）
 */
export async function deleteAPIKey(id: number): Promise<void> {
  return http<void>(`/api/v1/api-keys/${id}`, {
    method: "DELETE",
  });
}

/**
 * 获取 API Key 统计信息
 */
export async function getAPIKeyStats(): Promise<APIKeyStats> {
  return http<APIKeyStats>("/api/v1/api-keys/stats");
}
