import { useCallback } from "react";

import type { MessageInstance } from "antd/es/message/interface";

import {
  bulkCopyCategories,
  bulkMoveCategories,
  type CategoryBulkCopyPayload,
  type CategoryBulkMovePayload,
} from "../../../api/categories";
import type { CategoryLookups, ParentKey } from "../types";
import type { ClipboardState } from "./useCategoryClipboard";

interface SelectionPayload {
  selectedIds: number[];
  selectionParentId: ParentKey | undefined;
  lastSelectedId: number | null;
}

interface UseTreePasteParams {
  clipboard: ClipboardState | null;
  clipboardSourceSet: Set<number>;
  isMutating: boolean;
  setIsMutating: (value: boolean) => void;
  messageApi: MessageInstance;
  isDescendantOrSelf: (nodeId: number | null, sourceSet: Set<number>) => boolean;
  onInvalidateQueries: () => Promise<void>;
  onSelectionChange: (payload: SelectionPayload) => void;
  resetClipboard: () => void;
  lookups: CategoryLookups;
}

export function useTreePaste({
  clipboard,
  clipboardSourceSet,
  isMutating,
  setIsMutating,
  messageApi,
  isDescendantOrSelf,
  onInvalidateQueries,
  onSelectionChange,
  resetClipboard,
  lookups,
}: UseTreePasteParams) {
  const handlePaste = useCallback(
    async ({
      targetParentId,
      insertBeforeId,
      insertAfterId,
      targetNodeId,
    }: {
      targetParentId: number | null;
      insertBeforeId?: number | null;
      insertAfterId?: number | null;
      targetNodeId?: number | null;
    }) => {
      if (!clipboard) {
        messageApi.warning("剪贴板为空");
        return;
      }
      if (isMutating) {
        return;
      }
      if (targetNodeId != null && isDescendantOrSelf(targetNodeId, clipboardSourceSet)) {
        messageApi.error("无法粘贴到剪贴板节点自身或其子节点");
        return;
      }
      if (isDescendantOrSelf(targetParentId, clipboardSourceSet)) {
        messageApi.error("无法粘贴到剪贴板节点自身或其子节点");
        return;
      }
      if (insertBeforeId != null && clipboardSourceSet.has(insertBeforeId)) {
        messageApi.error("无法以剪贴板节点作为参考位置");
        return;
      }
      if (insertAfterId != null && clipboardSourceSet.has(insertAfterId)) {
        messageApi.error("无法以剪贴板节点作为参考位置");
        return;
      }

      setIsMutating(true);
      try {
        if (clipboard.mode === "copy") {
          const payload: CategoryBulkCopyPayload = {
            source_ids: clipboard.sourceIds,
            target_parent_id: targetParentId ?? null,
          };
          if (insertBeforeId != null) {
            payload.insert_before_id = insertBeforeId;
          }
          if (insertAfterId != null) {
            payload.insert_after_id = insertAfterId;
          }
          await bulkCopyCategories(payload);
          messageApi.success(`已粘贴 ${clipboard.sourceIds.length} 个目录`);
        } else {
          const payload: CategoryBulkMovePayload = {
            source_ids: clipboard.sourceIds,
            target_parent_id: targetParentId ?? null,
          };
          if (insertBeforeId != null) {
            payload.insert_before_id = insertBeforeId;
          }
          if (insertAfterId != null) {
            payload.insert_after_id = insertAfterId;
          }
          await bulkMoveCategories(payload);
          messageApi.success(`已移动 ${clipboard.sourceIds.length} 个目录`);
          resetClipboard();
          onSelectionChange({ selectedIds: [], selectionParentId: undefined, lastSelectedId: null });
        }
        await onInvalidateQueries();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "粘贴失败，请重试";
        messageApi.error(msg);
      } finally {
        setIsMutating(false);
      }
    },
    [
      clipboard,
      clipboardSourceSet,
      isMutating,
      setIsMutating,
      messageApi,
      isDescendantOrSelf,
      onInvalidateQueries,
      onSelectionChange,
      resetClipboard,
    ],
  );

  const handlePasteAsChild = useCallback(
    (nodeId: number) => {
      void handlePaste({ targetParentId: nodeId, targetNodeId: nodeId });
    },
    [handlePaste],
  );

  const handlePasteBefore = useCallback(
    (nodeId: number) => {
      const parentId = lookups.byId.get(nodeId)?.parent_id ?? null;
      void handlePaste({ targetParentId: parentId, insertBeforeId: nodeId });
    },
    [handlePaste, lookups.byId],
  );

  const handlePasteAfter = useCallback(
    (nodeId: number) => {
      const parentId = lookups.byId.get(nodeId)?.parent_id ?? null;
      void handlePaste({ targetParentId: parentId, insertAfterId: nodeId });
    },
    [handlePaste, lookups.byId],
  );

  return {
    handlePasteAsChild,
    handlePasteBefore,
    handlePasteAfter,
  } as const;
}
