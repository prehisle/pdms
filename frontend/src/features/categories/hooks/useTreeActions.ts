import { useCallback, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createCategory,
  deleteCategory,
  purgeCategory,
  restoreCategory,
  updateCategory,
  type CategoryCreatePayload,
  type CategoryUpdatePayload,
} from "../../../api/categories";

interface MessageApiLike {
  success: (msg: string) => void;
  error: (msg: string) => void;
}

export function useTreeActions(messageApi: MessageApiLike) {
  const queryClient = useQueryClient();
  const [isMutating, setIsMutating] = useState(false);

  const invalidateTree = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["categories-tree"] });
  }, [queryClient]);

  const invalidateTrash = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["categories-trash"] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (payload: CategoryCreatePayload) => createCategory(payload),
    onSuccess: async () => {
      messageApi.success("目录创建成功");
      setIsMutating(false);
      await Promise.all([invalidateTree(), invalidateTrash()]);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "目录创建失败";
      messageApi.error(msg);
      setIsMutating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CategoryUpdatePayload }) =>
      updateCategory(id, payload),
    onSuccess: async () => {
      messageApi.success("目录更新成功");
      setIsMutating(false);
      await invalidateTree();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "目录更新失败";
      messageApi.error(msg);
      setIsMutating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: async () => {
      messageApi.success("目录删除成功");
      setIsMutating(false);
      await Promise.all([invalidateTree(), invalidateTrash()]);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "目录删除失败";
      messageApi.error(msg);
      setIsMutating(false);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreCategory(id),
    onSuccess: async () => {
      messageApi.success("目录已恢复");
      await Promise.all([invalidateTree(), invalidateTrash()]);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "恢复目录失败";
      messageApi.error(msg);
    },
  });

  const purgeMutation = useMutation({
    mutationFn: (id: number) => purgeCategory(id),
    onSuccess: async () => {
      messageApi.success("目录已彻底删除");
      await invalidateTrash();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "彻底删除失败";
      messageApi.error(msg);
    },
  });

  const setMutating = useCallback((value: boolean) => setIsMutating(value), []);

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    restoreMutation,
    purgeMutation,
    setMutating,
    isMutating,
  } as const;
}
