import { useCallback } from "react";

import type { MessageInstance } from "antd/es/message/interface";
import type { TreeProps } from "antd";
import { useQueryClient } from "@tanstack/react-query";

import { repositionCategory, type Category } from "../../../api/categories";
import type { CategoryLookups, TreeDataNode } from "../types";
import { getParentId } from "../utils";

type TreeDropInfo = Parameters<NonNullable<TreeProps<TreeDataNode>["onDrop"]>>[0];

interface UseTreeDragParams {
  lookups: CategoryLookups;
  messageApi: MessageInstance;
  closeContextMenu: (reason?: string) => void;
  dragDebugEnabled: boolean;
  menuDebugEnabled: boolean;
  setIsMutating: (value: boolean) => void;
  onRefresh: () => Promise<void> | void;
  onInvalidateQueries: () => Promise<void>;
}

export function useTreeDrag({
  lookups,
  messageApi,
  closeContextMenu,
  dragDebugEnabled,
  menuDebugEnabled,
  setIsMutating,
  onRefresh,
  onInvalidateQueries,
}: UseTreeDragParams) {
  const queryClient = useQueryClient();

  const handleDrop = useCallback<NonNullable<TreeProps<TreeDataNode>["onDrop"]>>(
    async (info) => {
      const { dragNode, node, dropToGap, dropPosition } = info as TreeDropInfo;
      const dragId = Number(dragNode.key);
      const dropId = Number(node.key);
      if (menuDebugEnabled) {
        // eslint-disable-next-line no-console
        console.log("[menu-debug] handleDrop", {
          dragId,
          dropId,
          dropToGap,
          dropPosition,
        });
      }
      closeContextMenu("tree-drop");
      const nodePosition = Number((node.pos ?? "0").split("-").pop() ?? 0);
      const dropRelative = dropPosition - nodePosition;

      const baseParentId = getParentId(node);
      let targetParentId: number | null;
      if (dropToGap) {
        targetParentId = baseParentId;
      } else if (dropRelative < 0) {
        targetParentId = baseParentId;
      } else {
        targetParentId = dropId;
      }

      const dragCategory = lookups.byId.get(dragId);
      if (!dragCategory) {
        messageApi.error("拖拽节点信息缺失，无法完成操作");
        return;
      }

      const sourceParentId = getParentId(dragNode);

      const targetSiblingsBaseline = lookups.parentToChildren.get(targetParentId) ?? [];
      const orderedWithoutDrag = targetSiblingsBaseline.filter((item) => item.id !== dragId);

      let insertIndex = orderedWithoutDrag.length;
      const dropOnSameParentTop =
        !dropToGap &&
        dropRelative === 0 &&
        sourceParentId !== null &&
        Number(node.key) === sourceParentId;
      if (dropOnSameParentTop) {
        insertIndex = 0;
      }

      if (dropToGap) {
        const targetIndex = orderedWithoutDrag.findIndex((item) => item.id === dropId);
        if (targetIndex === -1) {
          insertIndex = orderedWithoutDrag.length;
        } else {
          insertIndex = targetIndex + (dropRelative > 0 ? 1 : 0);
        }
      }

      const updatedDragCategory: Category = {
        ...dragCategory,
        parent_id: targetParentId,
      };

      const reordered = [...orderedWithoutDrag];
      reordered.splice(insertIndex, 0, updatedDragCategory);
      const orderedIds = reordered.map((item) => item.id);

      const originalIds = targetSiblingsBaseline.map((item) => item.id);
      const isSameOrder =
        sourceParentId === targetParentId &&
        orderedIds.length === originalIds.length &&
        orderedIds.every((id, idx) => id === originalIds[idx]);
      if (dragDebugEnabled) {
        // eslint-disable-next-line no-console
        console.log("[drag-debug] drop event", {
          dragId,
          dropId,
          dropPosition,
          dropRelative,
          sourceParentId,
          targetParentId,
          orderedIds,
          originalIds,
        });
      }

      if (isSameOrder) {
        if (dragDebugEnabled) {
          // eslint-disable-next-line no-console
          console.log("[drag-debug] skip reorder: order unchanged");
        }
        return;
      }

      setIsMutating(true);
      try {
        const repositionPayload =
          sourceParentId === targetParentId
            ? { ordered_ids: orderedIds }
            : {
                new_parent_id: targetParentId,
                ordered_ids: orderedIds,
              };
        if (dragDebugEnabled) {
          // eslint-disable-next-line no-console
          console.log("[drag-debug] reposition payload", {
            dragId,
            payload: repositionPayload,
          });
        }
        await repositionCategory(dragId, repositionPayload);
        messageApi.success("目录顺序已更新");
        await Promise.resolve(onRefresh());
        await queryClient.invalidateQueries({ queryKey: ["categories-tree"] });
        await onInvalidateQueries();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "调整目录顺序失败，请重试";
        messageApi.error(msg);
      } finally {
        setIsMutating(false);
      }
    },
    [
      closeContextMenu,
      dragDebugEnabled,
      lookups.byId,
      lookups.parentToChildren,
      messageApi,
      menuDebugEnabled,
      onInvalidateQueries,
      onRefresh,
      queryClient,
      setIsMutating,
    ],
  );

  return { handleDrop } as const;
}
