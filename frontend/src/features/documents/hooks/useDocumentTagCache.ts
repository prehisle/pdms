import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_NAMESPACE = "ydms_tag_cache_v1";
const MAX_TAGS_PER_TYPE = 50;

type CachedTag = {
  value: string;
  lastUsed: number;
};

type TagCache = Record<string, CachedTag[]>;

const isBrowserEnvironment = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const buildStorageKey = (userId: number | string): string =>
  `${STORAGE_NAMESPACE}:${userId}`;

const normalizeTags = (tags: string[]): string[] => {
  const trimmed = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return Array.from(new Set(trimmed));
};

const mergeTags = (existing: CachedTag[], incoming: string[]): CachedTag[] => {
  if (incoming.length === 0) {
    return existing;
  }

  const map = new Map<string, CachedTag>();
  existing.forEach((tag) => {
    map.set(tag.value, tag);
  });

  const now = Date.now();
  incoming.forEach((tag, index) => {
    map.set(tag, {
      value: tag,
      lastUsed: now + incoming.length - index,
    });
  });

  const merged = Array.from(map.values());
  merged.sort((a, b) => b.lastUsed - a.lastUsed);
  return merged.slice(0, MAX_TAGS_PER_TYPE);
};

const loadCache = (userId: number | string | null | undefined): TagCache => {
  if (!userId || !isBrowserEnvironment()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(userId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as TagCache;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return {};
  } catch (error) {
    console.warn("[useDocumentTagCache] Failed to load cache:", error);
    return {};
  }
};

const persistCache = (userId: number | string | null | undefined, cache: TagCache) => {
  if (!userId || !isBrowserEnvironment()) {
    return;
  }
  try {
    window.localStorage.setItem(buildStorageKey(userId), JSON.stringify(cache));
  } catch (error) {
    console.warn("[useDocumentTagCache] Failed to persist cache:", error);
  }
};

export const useDocumentTagCache = (userId: number | null | undefined) => {
  const [cache, setCache] = useState<TagCache>(() => loadCache(userId));

  useEffect(() => {
    setCache(loadCache(userId));
  }, [userId]);

  const upsert = useCallback(
    (docType: string | undefined, tags: string[]) => {
      if (!userId || !docType) {
        return;
      }
      const normalized = normalizeTags(tags);
      if (normalized.length === 0) {
        return;
      }
      setCache((previous) => {
        const existing = previous[docType] ?? [];
        const nextList = mergeTags(existing, normalized);
        if (existing.length === nextList.length) {
          const same = existing.every((item, index) => item.value === nextList[index]?.value);
          if (same) {
            return previous;
          }
        }
        const nextCache: TagCache = { ...previous, [docType]: nextList };
        persistCache(userId, nextCache);
        return nextCache;
      });
    },
    [userId],
  );

  const getTags = useCallback(
    (docType: string | undefined): string[] => {
      if (!docType) {
        return [];
      }
      const entries = cache[docType] ?? [];
      return entries.map((entry) => entry.value);
    },
    [cache],
  );

  const getAllTags = useMemo(
    () =>
      Object.values(cache)
        .flat()
        .map((entry) => entry.value),
    [cache],
  );

  return {
    getTags,
    getAllTags,
    upsert,
  };
};
