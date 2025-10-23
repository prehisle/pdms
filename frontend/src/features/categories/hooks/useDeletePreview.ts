import { useCallback, useState } from "react";

import { bulkCheckCategories, type CategoryBulkCheckResponse } from "../../../api/categories";

interface MessageApiLike {
  error: (msg: string) => void;
}

type DeleteMode = "soft" | "purge";

interface DeletePreviewState {
  visible: boolean;
  mode: DeleteMode;
  ids: number[];
  loading: boolean;
  result: CategoryBulkCheckResponse | null;
}

const initialState: DeletePreviewState = {
  visible: false,
  mode: "soft",
  ids: [],
  loading: false,
  result: null,
};

export function useDeletePreview(messageApi: MessageApiLike) {
  const [state, setState] = useState<DeletePreviewState>(initialState);

  const closePreview = useCallback(() => {
    setState(initialState);
  }, []);

  const openPreview = useCallback(
    (mode: DeleteMode, ids: number[]) => {
      if (ids.length === 0) {
        return;
      }
      setState({ visible: true, mode, ids, loading: true, result: null });
      bulkCheckCategories({ ids, include_descendants: true })
        .then((resp) => {
          setState((prev) => ({ ...prev, loading: false, result: resp }));
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "删除校验失败，请重试";
          messageApi.error(msg);
          setState(initialState);
        });
    },
    [messageApi],
  );

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  return {
    deletePreview: state,
    openPreview,
    closePreview,
    setLoading,
  } as const;
}
