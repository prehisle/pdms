import { useCallback, useMemo, useState } from "react";

import type { MessageInstance } from "antd/es/message/interface";

import type { ParentKey } from "../types";

export type ClipboardMode = "copy" | "cut";

export interface ClipboardState {
  mode: ClipboardMode;
  sourceIds: number[];
  parentId: number | null;
}

export interface ClipboardSnapshot {
  ids: number[];
  parentId: ParentKey;
}

interface UseCategoryClipboardParams {
  messageApi: MessageInstance;
  selectedIds: number[];
  selectionParentId: ParentKey | undefined;
}

export function useCategoryClipboard({
  messageApi,
  selectedIds,
  selectionParentId,
}: UseCategoryClipboardParams) {
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  const clipboardSourceSet = useMemo(() => new Set(clipboard?.sourceIds ?? []), [clipboard]);

  const copySelection = useCallback(
    (snapshot?: ClipboardSnapshot) => {
      const effectiveIds = snapshot?.ids ?? selectedIds;
      const effectiveParentRaw = snapshot?.parentId ?? selectionParentId;
      if (effectiveParentRaw === undefined || effectiveIds.length === 0) {
        messageApi.warning("请先选择要复制的目录");
        return;
      }
      const effectiveParent = effectiveParentRaw ?? null;
      setClipboard({ mode: "copy", sourceIds: [...effectiveIds], parentId: effectiveParent });
      messageApi.success(`已复制 ${effectiveIds.length} 个目录`);
    },
    [messageApi, selectedIds, selectionParentId],
  );

  const cutSelection = useCallback(
    (snapshot?: ClipboardSnapshot) => {
      const effectiveIds = snapshot?.ids ?? selectedIds;
      const effectiveParentRaw = snapshot?.parentId ?? selectionParentId;
      if (effectiveParentRaw === undefined || effectiveIds.length === 0) {
        messageApi.warning("请先选择要剪切的目录");
        return;
      }
      const effectiveParent = effectiveParentRaw ?? null;
      setClipboard({ mode: "cut", sourceIds: [...effectiveIds], parentId: effectiveParent });
      messageApi.info(`已剪切 ${effectiveIds.length} 个目录`);
    },
    [messageApi, selectedIds, selectionParentId],
  );

  const clearClipboard = useCallback(() => {
    setClipboard(null);
    messageApi.success("剪贴板已清空");
  }, [messageApi]);

  const resetClipboard = useCallback(() => {
    setClipboard(null);
  }, []);

  return {
    clipboard,
    clipboardSourceSet,
    copySelection,
    cutSelection,
    clearClipboard,
    resetClipboard,
  } as const;
}
