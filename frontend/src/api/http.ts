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

export async function http<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = apiBaseUrl ? `${apiBaseUrl}${path}` : path;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
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
