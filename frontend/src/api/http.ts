const DEFAULT_API_BASE_URL =
  typeof window !== "undefined" ? window.location.origin : "";

const configuredBase = import.meta.env.VITE_API_BASE_URL;
const normalizedBase =
  typeof configuredBase === "string" ? configuredBase.trim() : undefined;
const cleanedBase =
  normalizedBase && normalizedBase.length > 0
    ? normalizedBase.replace(/\/+$/, "")
    : DEFAULT_API_BASE_URL;

const apiBaseUrl = cleanedBase;

/**
 * Token 存储键名
 */
const TOKEN_KEY = "ydms_auth_token";

/**
 * 获取存储的 token
 */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export async function http<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = apiBaseUrl ? `${apiBaseUrl}${path}` : path;

  // 自动添加 Authorization header
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();

    // 如果是 401 未授权，可能需要重新登录
    if (response.status === 401) {
      // 清除过期的 token
      if (typeof window !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
      }
      // 触发全局事件，让 AuthContext 处理
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
    }

    throw new Error(
      `Request failed [${response.status}]: ${
        text || response.statusText || "Unknown error"
      }`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null) return;
        usp.append(key, String(item));
      });
      return;
    }
    usp.set(key, String(value));
  });
  const query = usp.toString();
  return query ? `?${query}` : "";
}
