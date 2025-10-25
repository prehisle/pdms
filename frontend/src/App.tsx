import {
  Button,
  Drawer,
  Form,
  Layout,
  Popconfirm,
  Spin,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import { Category, getCategoryTree } from "./api/categories";
import {
  Document,
  DocumentListParams,
  DocumentReorderPayload,
  DocumentTrashParams,
  DocumentTrashPage,
  DocumentVersionsPage,
  deleteDocument,
  getDeletedDocuments,
  getDocumentVersions,
  getNodeDocuments,
  purgeDocument,
  reorderDocuments,
  restoreDocument,
  restoreDocumentVersion,
} from "./api/documents";
import { CategoryTreePanel } from "./features/categories/components/CategoryTreePanel";
import { CategoryTrashModal } from "./features/categories/components/CategoryTrashModal";
import { CategoryDeletePreviewModal } from "./features/categories/components/CategoryDeletePreviewModal";
import { CategoryFormModal } from "./features/categories/components/CategoryFormModal";
import { useTrashQuery } from "./features/categories/hooks/useTrashQuery";
import { useDeletePreview } from "./features/categories/hooks/useDeletePreview";
import { useTreeActions } from "./features/categories/hooks/useTreeActions";
import type { ParentKey } from "./features/categories/types";
import { buildLookups } from "./features/categories/utils";
import { DocumentPanel } from "./features/documents/components/DocumentPanel";
import { DOCUMENT_TYPES } from "./features/documents/constants";
import type {
  DocumentFilterFormValues,
  MetadataFilterFormValue,
} from "./features/documents/types";
import type { MetadataOperator } from "./api/documents";
import { DocumentHistoryDrawer } from "./features/documents/components/DocumentHistoryDrawer";
import { DocumentTrashDrawer } from "./features/documents/components/DocumentTrashDrawer";
import { DocumentReorderModal } from "./features/documents/components/DocumentReorderModal";
const dragDebugEnabled =
  (import.meta.env.VITE_DEBUG_DRAG ?? "").toString().toLowerCase() === "1";
const menuDebugEnabled =
  (import.meta.env.VITE_DEBUG_MENU ?? "").toString().toLowerCase() === "1";

const DocumentEditorLazy = lazy(() =>
  import("./features/documents/components/DocumentEditor").then((module) => ({
    default: module.DocumentEditor,
  })),
);

const DocumentEditorFallback = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
    <Spin size="large" tip="加载编辑器..." />
  </div>
);

const { Sider, Content } = Layout;

const App = () => {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["categories-tree"],
    queryFn: () => getCategoryTree(),
  });
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionParentId, setSelectionParentId] = useState<number | null | undefined>(undefined);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState<{
    open: boolean;
    parentId: number | null;
  }>({ open: false, parentId: null });
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [categoryForm] = Form.useForm<{ name: string }>();
  const [documentEditorState, setDocumentEditorState] = useState<{
    open: boolean;
    docId: number | null;
    nodeId: number | null;
    mode: "create" | "edit";
  }>({ open: false, docId: null, nodeId: null, mode: "edit" });
  const [documentTrashOpen, setDocumentTrashOpen] = useState(false);
  const [documentTrashParams, setDocumentTrashParams] = useState<DocumentTrashParams>({
    page: 1,
    size: 20,
  });
  const [documentHistoryState, setDocumentHistoryState] = useState<{
    open: boolean;
    docId: number | null;
    title?: string;
  }>({ open: false, docId: null, title: undefined });
  const [documentHistoryParams, setDocumentHistoryParams] = useState({ page: 1, size: 10 });
  const [reorderModal, setReorderModal] = useState(false);
  const [documentFilters, setDocumentFilters] = useState<DocumentFilterFormValues>({});
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [documentFilterForm] = Form.useForm<DocumentFilterFormValues>();
  const {
    trashQuery,
    trashItems,
    isInitialLoading: isTrashInitialLoading,
    selectedRowKeys: selectedTrashRowKeys,
    setSelectedRowKeys,
    handleBulkRestore,
    handleBulkPurge,
    isProcessing: isTrashProcessing,
  } = useTrashQuery(messageApi);

  const handleTrashBulkRestore = useCallback(async () => {
    await handleBulkRestore();
    await queryClient.invalidateQueries({ queryKey: ["categories-tree"] });
  }, [handleBulkRestore, queryClient]);

  const handleTrashBulkPurge = useCallback(async () => {
    await handleBulkPurge();
    await queryClient.invalidateQueries({ queryKey: ["categories-tree"] });
  }, [handleBulkPurge, queryClient]);

  const {
    deletePreview,
    openPreview: openDeletePreview,
    closePreview,
    setLoading: setDeletePreviewLoading,
  } = useDeletePreview(messageApi);

  useEffect(() => {
    document.title = "题库目录管理";
  }, []);

  const selectedNodeId = selectedIds.length === 1 ? selectedIds[0] : null;

  const documentsQuery = useQuery({
    queryKey: ["node-documents", selectedNodeId, documentFilters, includeDescendants],
    queryFn: async () => {
      if (selectedNodeId == null) {
        return [] as Document[];
      }
      const params: DocumentListParams = {};
      if (documentFilters.query?.trim()) {
        params.query = documentFilters.query.trim();
      }
      if (documentFilters.type) {
        params.type = documentFilters.type;
      }
      if (documentFilters.docId) {
        const numericId = Number(documentFilters.docId);
        if (!Number.isNaN(numericId)) {
          params.id = [numericId];
        }
      }
      const metadataClauses = sanitizeMetadataFilters(documentFilters.metadataFilters);
      if (metadataClauses) {
        params.metadataClauses = metadataClauses;
      }
      params.size = 100;
      params.include_descendants = includeDescendants;

      const docs = await getNodeDocuments(selectedNodeId, params);

      // Sort by position to maintain consistent order
      return docs.sort((a, b) => a.position - b.position);
    },
    enabled: selectedNodeId != null,
  });

  const documents = selectedNodeId == null ? [] : documentsQuery.data ?? [];
  const categoriesList = data ?? [];

  const documentTrashQuery = useQuery({
    queryKey: ["documents-trash", documentTrashParams],
    queryFn: () => getDeletedDocuments(documentTrashParams),
    enabled: documentTrashOpen,
    staleTime: 10_000,
  });

  const handleRefreshDocumentTrash = useCallback(() => {
    void documentTrashQuery.refetch();
  }, [documentTrashQuery]);

  const documentHistoryQuery = useQuery({
    queryKey: ["document-history", documentHistoryState.docId, documentHistoryParams],
    queryFn: async () => {
      if (documentHistoryState.docId == null) {
        return null as DocumentVersionsPage | null;
      }
      return getDocumentVersions(documentHistoryState.docId, documentHistoryParams);
    },
    enabled: documentHistoryState.open && documentHistoryState.docId != null,
  });

  const {
    createMutation,
    updateMutation,
    deleteMutation,
    bulkDeleteMutation,
    restoreMutation,
    purgeMutation,
    setMutating,
    isMutating,
  } = useTreeActions(messageApi);

  const trashTableColumns = useMemo(
    () =>
      buildTrashColumns(
        restoreMutation.isPending,
        purgeMutation.isPending,
        (id: number) => restoreMutation.mutate(id),
        (id: number) => purgeMutation.mutate(id),
      ),
    [restoreMutation.isPending, purgeMutation.isPending, restoreMutation.mutate, purgeMutation.mutate],
  );

  const lookups = useMemo(() => buildLookups(data ?? []), [data]);

  const handleSelectionChange = useCallback(
    ({
      selectedIds: nextIds,
      selectionParentId: nextParent,
      lastSelectedId: nextLast,
    }: {
      selectedIds: number[];
      selectionParentId: ParentKey | undefined;
      lastSelectedId: number | null;
    }) => {
      setSelectedIds(nextIds);
      setSelectionParentId(nextParent);
      setLastSelectedId(nextLast);
    },
    [],
  );

  const handleRequestCreate = useCallback(
    (parentId: number | null) => {
      categoryForm.resetFields();
      setShowCreateModal({ open: true, parentId });
    },
    [categoryForm],
  );

  const handleRequestRename = useCallback(() => {
    if (selectedIds.length !== 1) {
      return;
    }
    const current = lookups.byId.get(selectedIds[0]);
    if (!current) {
      return;
    }
    categoryForm.setFieldsValue({ name: current.name });
    setShowRenameModal(true);
  }, [categoryForm, lookups, selectedIds]);

  const handleRequestDelete = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) {
        return;
      }
      openDeletePreview("soft", ids);
    },
    [openDeletePreview],
  );

  const handleOpenTrash = useCallback(() => {
    setSelectedRowKeys([]);
    setTrashModalOpen(true);
    void trashQuery.refetch();
  }, [setSelectedRowKeys, trashQuery]);

  const handleRefreshTree = useCallback(() => refetch(), [refetch]);

  const invalidateCategoryQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["categories-tree"] }),
      queryClient.invalidateQueries({ queryKey: ["categories-trash"] }),
    ]);
  }, [queryClient]);

  const handleIncludeDescendantsChange = useCallback(
    (value: boolean) => setIncludeDescendants(value),
    [],
  );

  useEffect(() => {
    if (showRenameModal && selectedIds.length === 1) {
      const current = lookups.byId.get(selectedIds[0]);
      if (current) {
        categoryForm.setFieldsValue({ name: current.name });
      }
    }
  }, [showRenameModal, selectedIds, lookups, categoryForm]);

  useEffect(() => {
    documentFilterForm.resetFields();
    setDocumentFilters({});
  }, [selectedNodeId, documentFilterForm]);

  const handleConfirmDelete = useCallback(() => {
    if (!deletePreview.visible || deletePreview.ids.length === 0) {
      return;
    }
    const targetIds = deletePreview.ids;
    setDeletePreviewLoading(true);
    const handleError = (err: unknown, fallback: string) => {
      const msg = err instanceof Error ? err.message : fallback;
      messageApi.error(msg);
      setDeletePreviewLoading(false);
    };
    if (deletePreview.mode === "soft") {
      if (targetIds.length === 1) {
        const targetId = targetIds[0];
        deleteMutation.mutate(targetId, {
          onSuccess: () => {
            closePreview();
          },
          onError: (err) => handleError(err, "删除失败，请重试"),
        });
      } else {
        bulkDeleteMutation.mutate(
          { ids: targetIds },
          {
            onSuccess: () => {
              closePreview();
            },
            onError: (err) => handleError(err, "批量删除失败，请重试"),
          },
        );
      }
    } else {
      const targetId = targetIds[0];
      purgeMutation.mutate(targetId, {
        onSuccess: () => {
          closePreview();
        },
        onError: (err) => handleError(err, "彻底删除失败，请重试"),
      });
    }
  }, [
    bulkDeleteMutation,
    closePreview,
    deleteMutation,
    deletePreview,
    messageApi,
    purgeMutation,
    setDeletePreviewLoading,
  ]);

  const handleOpenAddDocument = useCallback((nodeId: number) => {
    setDocumentEditorState({ open: true, docId: null, nodeId, mode: "create" });
  }, []);
  const handleDocumentSearch = useCallback(
    (values: DocumentFilterFormValues) => {
      const trimmed: DocumentFilterFormValues = {
        ...values,
        docId: values.docId?.trim() || undefined,
        query: values.query?.trim() || undefined,
      };
      const sanitizedMetadata = sanitizeMetadataFilters(values.metadataFilters);
      if (sanitizedMetadata) {
        trimmed.metadataFilters = sanitizedMetadata;
      } else {
        delete trimmed.metadataFilters;
      }
      setDocumentFilters(trimmed);
    },
    [],
  );

  const handleDocumentReset = useCallback(() => {
    documentFilterForm.resetFields();
    setDocumentFilters({});
  }, [documentFilterForm]);

  const handleOpenDocumentTrash = useCallback(() => {
    setDocumentTrashOpen(true);
  }, []);

  const handleCloseDocumentTrash = useCallback(() => {
    setDocumentTrashOpen(false);
  }, []);

  const handleDocumentTrashSearch = useCallback((query?: string) => {
    setDocumentTrashParams((prev) => ({
      ...prev,
      page: 1,
      query,
    }));
  }, []);

  const handleDocumentTrashPageChange = useCallback((page: number, pageSize?: number) => {
    setDocumentTrashParams((prev) => ({
      ...prev,
      page,
      size: pageSize ?? prev.size,
    }));
  }, []);

  const handleCloseDocumentHistory = useCallback(() => {
    setDocumentHistoryState({ open: false, docId: null, title: undefined });
  }, []);

  const handleDocumentHistoryPageChange = useCallback((page: number, pageSize?: number) => {
    setDocumentHistoryParams((prev) => ({
      ...prev,
      page,
      size: pageSize ?? prev.size,
    }));
  }, []);

  const handleEditDocument = useCallback(
    (doc: Document) => {
      setDocumentEditorState({
        open: true,
        docId: doc.id,
        nodeId: selectedNodeId,
        mode: "edit",
      });
    },
    [selectedNodeId],
  );


  // documentColumns will be defined later after mutations and callbacks


  const deleteDocumentMutation = useMutation<void, Error, number>({
    mutationFn: async (docId) => {
      await deleteDocument(docId);
    },
    onSuccess: async (_result, docId) => {
      messageApi.success("文档已移入回收站");
      await queryClient.invalidateQueries({ queryKey: ["node-documents"] });
      await queryClient.invalidateQueries({ queryKey: ["documents-trash"] });
      // 若当前编辑抽屉打开且删除的文档即为当前编辑文档，则关闭
      setDocumentEditorState((prev) => {
        if (prev.open && prev.docId === docId) {
          return { open: false, docId: null, nodeId: null, mode: "edit" };
        }
        return prev;
      });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "文档移入回收站失败";
      messageApi.error(msg);
    },
  });

  const restoreDocumentMutation = useMutation<Document, Error, number>({
    mutationFn: async (docId) => restoreDocument(docId),
    onSuccess: async () => {
      messageApi.success("文档已恢复");
      await queryClient.invalidateQueries({ queryKey: ["documents-trash"] });
      await queryClient.invalidateQueries({ queryKey: ["node-documents"] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "恢复文档失败";
      messageApi.error(msg);
    },
  });

  const purgeDocumentMutation = useMutation<void, Error, number>({
    mutationFn: async (docId) => {
      await purgeDocument(docId);
    },
    onSuccess: async () => {
      messageApi.success("文档已彻底删除");
      await queryClient.invalidateQueries({ queryKey: ["documents-trash"] });
      await queryClient.invalidateQueries({ queryKey: ["node-documents"] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "彻底删除失败";
      messageApi.error(msg);
    },
  });

  const restoreDocumentVersionMutation = useMutation<Document, Error, { docId: number; version: number }>({
    mutationFn: ({ docId, version }) => restoreDocumentVersion(docId, version),
    onSuccess: async (_doc, variables) => {
      messageApi.success(`已恢复至版本 v${variables.version}`);
      await queryClient.invalidateQueries({ queryKey: ["document-history", variables.docId] });
      await queryClient.invalidateQueries({ queryKey: ["node-documents"] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "版本回退失败";
      messageApi.error(msg);
    },
  });

  const handleCloseDocumentEditor = useCallback(() => {
    setDocumentEditorState({ open: false, docId: null, nodeId: null, mode: "edit" });
  }, []);

  const handleToolbarAddDocument = useCallback(() => {
    if (selectedNodeId == null) {
      messageApi.warning("请选择一个目录节点后再添加文档");
      return;
    }
    handleOpenAddDocument(selectedNodeId);
  }, [handleOpenAddDocument, messageApi, selectedNodeId]);

  const documentReorderMutation = useMutation({
    mutationFn: async (payload: DocumentReorderPayload) => {
      return reorderDocuments(payload);
    },
    onSuccess: async () => {
      messageApi.success("文档排序调整成功");
      setReorderModal(false);
      if (selectedNodeId != null) {
        await queryClient.invalidateQueries({ queryKey: ["node-documents", selectedNodeId] });
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "排序调整失败";
      messageApi.error(msg);
    },
  });

  const deletingDocId = deleteDocumentMutation.isPending ? deleteDocumentMutation.variables ?? null : null;
  const restoringDocId = restoreDocumentMutation.isPending ? restoreDocumentMutation.variables ?? null : null;
  const purgingDocId = purgeDocumentMutation.isPending ? purgeDocumentMutation.variables ?? null : null;
  const restoringVersionNumber = restoreDocumentVersionMutation.isPending
    ? restoreDocumentVersionMutation.variables?.version ?? null
    : null;

  const handleSoftDeleteDocument = useCallback(
    (doc: Document) => {
      deleteDocumentMutation.mutate(doc.id);
    },
    [deleteDocumentMutation],
  );

  const handleOpenDocumentHistory = useCallback((doc: Document) => {
    setDocumentHistoryState({ open: true, docId: doc.id, title: doc.title });
    setDocumentHistoryParams((prev) => ({ ...prev, page: 1 }));
  }, []);

  const documentColumns = useMemo<ColumnsType<Document>>(
    () => [
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        width: 80,
      },
      {
        title: "名称",
        dataIndex: "title",
        key: "title",
        render: (value: string) => <Typography.Text>{value}</Typography.Text>,
      },
      {
        title: "类型",
        dataIndex: "type",
        key: "type",
        render: (value: string | undefined) => (
          <Typography.Text>{value || "-"}</Typography.Text>
        ),
      },
      {
        title: "版本",
        dataIndex: "version_number",
        key: "version_number",
        width: 100,
        render: (value: number | undefined | null) => <Typography.Text>{value ?? "-"}</Typography.Text>,
      },
      {
        title: "位置",
        dataIndex: "position",
        key: "position",
        width: 80,
        render: (value: number) => <Typography.Text>{value}</Typography.Text>,
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        key: "updated_at",
        render: (value: string) => new Date(value).toLocaleString(),
      },
      {
        title: "操作",
        key: "actions",
        width: 200,
        render: (_: unknown, record: Document) => {
          const deleting = deletingDocId === record.id;
          return (
            <Space>
              <Tooltip title="编辑文档">
                <Button
                  icon={<EditOutlined />}
                  type="text"
                  shape="circle"
                  onClick={() => handleEditDocument(record)}
                  aria-label="编辑文档"
                />
              </Tooltip>
              <Popconfirm
                title="确认将该文档移入回收站？"
                okText="移入"
                cancelText="取消"
                onConfirm={() => handleSoftDeleteDocument(record)}
                disabled={deleteDocumentMutation.isPending && !deleting}
              >
                <Tooltip title="移入回收站">
                  <span style={{ display: "inline-flex" }}>
                    <Button
                      icon={<DeleteOutlined />}
                      type="text"
                      danger
                      shape="circle"
                      loading={deleteDocumentMutation.isPending && deleting}
                      aria-label="移入回收站"
                    />
                  </span>
                </Tooltip>
              </Popconfirm>
              <Tooltip title="历史版本">
                <Button
                  icon={<HistoryOutlined />}
                  type="text"
                  shape="circle"
                  onClick={() => handleOpenDocumentHistory(record)}
                  aria-label="查看历史版本"
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [
      deleteDocumentMutation.isPending,
      deletingDocId,
      handleEditDocument,
      handleOpenDocumentHistory,
      handleSoftDeleteDocument,
    ],
  );

  const handleOpenReorderModal = useCallback(() => {
    if (selectedNodeId == null || documents.length <= 1) {
      return;
    }
    setReorderModal(true);
  }, [documents.length, selectedNodeId]);

  const handleReorderConfirm = useCallback((orderedIds: number[]) => {
    if (selectedNodeId == null) {
      return;
    }
    documentReorderMutation.mutate({
      node_id: selectedNodeId,
      ordered_ids: orderedIds,
    });
  }, [documentReorderMutation, selectedNodeId]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {contextHolder}
      <Layout>
        <Sider
          width={360}
          style={{
            background: "#fff",
            padding: "16px",
            borderRight: "1px solid #f0f0f0",
          }}
        >
          <CategoryTreePanel
            categories={categoriesList}
            lookups={lookups}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            isMutating={isMutating}
            selectedIds={selectedIds}
            selectionParentId={selectionParentId}
            lastSelectedId={lastSelectedId}
            selectedNodeId={selectedNodeId}
            includeDescendants={includeDescendants}
            createLoading={createMutation.isPending}
            trashIsFetching={trashQuery.isFetching}
            messageApi={messageApi}
            dragDebugEnabled={dragDebugEnabled}
            menuDebugEnabled={menuDebugEnabled}
            onSelectionChange={handleSelectionChange}
            onRequestCreate={handleRequestCreate}
            onRequestRename={handleRequestRename}
            onRequestDelete={handleRequestDelete}
            onOpenTrash={handleOpenTrash}
            onOpenAddDocument={handleOpenAddDocument}
            onIncludeDescendantsChange={handleIncludeDescendantsChange}
            onRefresh={handleRefreshTree}
            onInvalidateQueries={invalidateCategoryQueries}
            setIsMutating={setMutating}
          />
        </Sider>
        <Content style={{ padding: "24px" }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <DocumentPanel
              filterForm={documentFilterForm}
              documentTypes={DOCUMENT_TYPES}
              selectedNodeId={selectedNodeId}
              documents={documents}
              columns={documentColumns}
              isLoading={documentsQuery.isLoading}
              isFetching={documentsQuery.isFetching}
              error={documentsQuery.error}
              onSearch={handleDocumentSearch}
              onReset={handleDocumentReset}
              onAddDocument={handleToolbarAddDocument}
              onReorderDocuments={handleOpenReorderModal}
              onOpenTrash={handleOpenDocumentTrash}
            />
          </Space>
        </Content>
      </Layout>
      <CategoryTrashModal
        open={trashModalOpen}
        loading={trashQuery.isFetching || isTrashProcessing}
        isInitialLoading={isTrashInitialLoading}
        error={trashQuery.error}
        trashItems={trashItems}
        columns={trashTableColumns}
        selectedRowKeys={selectedTrashRowKeys}
        onSelectedRowKeysChange={(keys) => setSelectedRowKeys(keys)}
        onRefresh={() => {
          void trashQuery.refetch();
        }}
        onClose={() => {
          setTrashModalOpen(false);
          setSelectedRowKeys([]);
        }}
        onBulkRestore={handleTrashBulkRestore}
        onBulkPurge={handleTrashBulkPurge}
        isMutating={isTrashProcessing}
        onClearSelection={() => setSelectedRowKeys([])}
      />
      <Drawer
        open={documentEditorState.open}
        width="100%"
        closable={false}
        maskClosable={false}
        destroyOnClose
        onClose={handleCloseDocumentEditor}
        styles={{ body: { padding: 0, height: "100%", display: "flex" } }}
      >
        {documentEditorState.open &&
        (documentEditorState.mode === "create" || documentEditorState.docId != null) ? (
          <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <Suspense fallback={<DocumentEditorFallback />}>
              <DocumentEditorLazy
                mode={documentEditorState.mode}
                docId={documentEditorState.mode === "edit" ? documentEditorState.docId ?? undefined : undefined}
                nodeId={documentEditorState.nodeId ?? undefined}
                onClose={handleCloseDocumentEditor}
              />
            </Suspense>
          </div>
        ) : null}
      </Drawer>
      <DocumentReorderModal
        open={reorderModal}
        documents={documents}
        loading={documentReorderMutation.isPending}
        onCancel={() => setReorderModal(false)}
        onConfirm={handleReorderConfirm}
      />
      <DocumentTrashDrawer
        open={documentTrashOpen}
        loading={documentTrashQuery.isLoading || documentTrashQuery.isFetching}
        data={documentTrashQuery.data}
        error={documentTrashQuery.error}
        onClose={handleCloseDocumentTrash}
        onRefresh={handleRefreshDocumentTrash}
        onSearch={handleDocumentTrashSearch}
        onPageChange={handleDocumentTrashPageChange}
        onRestore={(doc) => restoreDocumentMutation.mutate(doc.id)}
        onPurge={(doc) => purgeDocumentMutation.mutate(doc.id)}
        restoreLoadingId={restoringDocId}
        purgeLoadingId={purgingDocId}
        queryValue={documentTrashParams.query}
      />
      <DocumentHistoryDrawer
        open={documentHistoryState.open}
        documentTitle={documentHistoryState.title}
        loading={documentHistoryQuery.isLoading || documentHistoryQuery.isFetching}
        data={documentHistoryQuery.data ?? undefined}
        error={documentHistoryQuery.error ?? undefined}
        onClose={handleCloseDocumentHistory}
        onPageChange={handleDocumentHistoryPageChange}
        onRestore={(version) => {
          if (documentHistoryState.docId == null) return;
          restoreDocumentVersionMutation.mutate({
            docId: documentHistoryState.docId,
            version: version.version_number,
          });
        }}
        restoreLoadingVersion={restoringVersionNumber}
      />
      <CategoryDeletePreviewModal
        open={deletePreview.visible}
        mode={deletePreview.mode}
        loading={deletePreview.loading}
        result={deletePreview.result}
        confirmLoading={
          deletePreview.loading ||
          deleteMutation.isPending ||
          bulkDeleteMutation.isPending ||
          purgeMutation.isPending
        }
        onCancel={closePreview}
        onConfirm={handleConfirmDelete}
      />
      <CategoryFormModal
        open={showCreateModal.open}
        title={showCreateModal.parentId ? "新建子目录" : "新建根目录"}
        confirmLoading={createMutation.isPending}
        form={categoryForm}
        onCancel={() => setShowCreateModal({ open: false, parentId: null })}
        onSubmit={() => {
          categoryForm
            .validateFields()
            .then((values) => {
              setMutating(true);
              createMutation.mutate(
                {
                  name: values.name.trim(),
                  parent_id: showCreateModal.parentId,
                },
                {
                  onSuccess: () => {
                    setShowCreateModal({ open: false, parentId: null });
                  },
                  onError: () => {
                    setMutating(false);
                  },
                },
              );
            })
            .catch(() => undefined);
        }}
      />
      <CategoryFormModal
        open={showRenameModal}
        title="重命名目录"
        confirmLoading={updateMutation.isPending}
        form={categoryForm}
        onCancel={() => setShowRenameModal(false)}
        onSubmit={() => {
          categoryForm
            .validateFields()
            .then((values) => {
              if (selectedIds.length !== 1) return;
              setMutating(true);
              updateMutation.mutate(
                {
                  id: selectedIds[0],
                  payload: { name: values.name.trim() },
                },
                {
                  onSuccess: () => {
                    setShowRenameModal(false);
                  },
                  onError: () => {
                    setMutating(false);
                  },
                },
              );
            })
            .catch(() => undefined);
        }}
      />
    </Layout>
  );
};

export default App;

interface SanitizedMetadataFilter {
  key: string;
  operator: MetadataOperator;
  values: string[];
}

function sanitizeMetadataFilters(
  filters?: MetadataFilterFormValue[],
): SanitizedMetadataFilter[] | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  const sanitized: SanitizedMetadataFilter[] = [];
  filters.forEach((filter) => {
    const key = filter.key?.trim();
    if (!key) {
      return;
    }
    const operator: MetadataOperator = filter.operator ?? "eq";
    switch (operator) {
      case "eq":
      case "like": {
        const value = typeof filter.value === "string" ? filter.value.trim() : "";
        if (value) {
          sanitized.push({ key, operator, values: [value] });
        }
        break;
      }
      case "in":
      case "any":
      case "all": {
        const raw = Array.isArray(filter.value) ? filter.value : [];
        const values = Array.from(
          new Set(raw.map((item) => item.trim()).filter((item) => item.length > 0)),
        );
        if (values.length > 0) {
          sanitized.push({ key, operator, values });
        }
        break;
      }
      case "gt":
      case "gte":
      case "lt":
      case "lte": {
        const value = typeof filter.value === "string" ? filter.value.trim() : "";
        if (value && !Number.isNaN(Number(value))) {
          sanitized.push({ key, operator, values: [value] });
        }
        break;
      }
      default:
        break;
    }
  });
  return sanitized.length > 0 ? sanitized : undefined;
}

function buildTrashColumns(
  restoreLoading: boolean,
  purgeLoading: boolean,
  onRestore: (id: number) => void,
  onPurge: (id: number) => void,
): ColumnsType<Category> {
  return [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      render: (value: string) => (
        <Space>
          <Typography.Text>{value}</Typography.Text>
          <Tag color="red">已删除</Tag>
        </Space>
      ),
    },
    {
      title: "路径",
      dataIndex: "path",
      key: "path",
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: "删除时间",
      dataIndex: "deleted_at",
      key: "deleted_at",
      render: (value?: string | null) => (value ? new Date(value).toLocaleString() : "-"),
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Tooltip title="恢复">
            <span style={{ display: "inline-flex" }}>
              <Button
                icon={<RollbackOutlined />}
                type="text"
                shape="circle"
                onClick={() => onRestore(record.id)}
                disabled={restoreLoading}
                loading={restoreLoading}
                aria-label="恢复目录"
              />
            </span>
          </Tooltip>
          <Popconfirm
            title="彻底删除后无法恢复，确认操作？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => onPurge(record.id)}
            disabled={purgeLoading}
          >
            <Tooltip title="彻底删除">
              <span style={{ display: "inline-flex" }}>
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  type="text"
                  shape="circle"
                  disabled={purgeLoading}
                  loading={purgeLoading}
                  aria-label="彻底删除"
                />
              </span>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}
