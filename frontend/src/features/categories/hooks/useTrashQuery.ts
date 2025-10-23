import { useCallback, useMemo, useState } from "react";
import type { Key } from "react";

import { useQuery } from "@tanstack/react-query";

import {
  bulkPurgeCategories,
  bulkRestoreCategories,
  getDeletedCategories,
  type Category,
} from "../../../api/categories";

interface MessageApiLike {
  success: (msg: string) => void;
  error: (msg: string) => void;
}

export function useTrashQuery(messageApi: MessageApiLike) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const query = useQuery({
    queryKey: ["categories-trash"],
    queryFn: () => getDeletedCategories(),
    enabled: false,
  });

  const isInitialLoading = useMemo(
    () => query.isLoading || (query.isFetching && !query.data),
    [query.isLoading, query.isFetching, query.data],
  );

  const handleBulkRestore = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      return;
    }
    const ids = selectedRowKeys.map((key) => Number(key));
    try {
      setIsProcessing(true);
      await bulkRestoreCategories({ ids });
      messageApi.success(`已恢复 ${ids.length} 个目录`);
      setSelectedRowKeys([]);
      await query.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "批量恢复失败，请重试";
      messageApi.error(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [messageApi, query, selectedRowKeys]);

  const handleBulkPurge = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      return;
    }
    const ids = selectedRowKeys.map((key) => Number(key));
    try {
      setIsProcessing(true);
      await bulkPurgeCategories({ ids });
      messageApi.success(`已彻底删除 ${ids.length} 个目录`);
      setSelectedRowKeys([]);
      await query.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "批量彻底删除失败，请重试";
      messageApi.error(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [messageApi, query, selectedRowKeys]);

  return {
    trashQuery: query,
    trashItems: (query.data ?? []) as Category[],
    isInitialLoading,
    selectedRowKeys,
    setSelectedRowKeys,
    handleBulkRestore,
    handleBulkPurge,
    isProcessing,
  } as const;
}
