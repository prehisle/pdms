import {
  Button,
  Form,
  Layout,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DeleteOutlined,
  EditOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import { Category, getCategoryTree } from "./api/categories";
import {
  Document,
  DocumentCreatePayload,
  DocumentListParams,
  DocumentReorderPayload,
  bindDocument,
  createDocument,
  getNodeDocuments,
  reorderDocuments,
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
  DocumentFormValues,
} from "./features/documents/types";
import { DocumentCreateModal } from "./features/documents/components/DocumentCreateModal";
import { DocumentReorderModal } from "./features/documents/components/DocumentReorderModal";
const dragDebugEnabled =
  (import.meta.env.VITE_DEBUG_DRAG ?? "").toString().toLowerCase() === "1";
const menuDebugEnabled =
  (import.meta.env.VITE_DEBUG_MENU ?? "").toString().toLowerCase() === "1";

const { Sider, Content } = Layout;

const App = () => {
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
  const [documentModal, setDocumentModal] = useState<{ open: boolean; nodeId: number | null }>(
    { open: false, nodeId: null },
  );
  const [reorderModal, setReorderModal] = useState(false);
  const [documentFilters, setDocumentFilters] = useState<DocumentFilterFormValues>({});
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [documentFilterForm] = Form.useForm<DocumentFilterFormValues>();
  const [documentForm] = Form.useForm<DocumentFormValues>();
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
      params.size = 100;
      params.include_descendants = includeDescendants;

      let docs = await getNodeDocuments(selectedNodeId, params);

      // Client-side filtering by document ID if specified
      if (documentFilters.docId) {
        const numericId = Number(documentFilters.docId);
        if (!Number.isNaN(numericId)) {
          docs = docs.filter(doc => doc.id === numericId);
        }
      }

      // Sort by position to maintain consistent order
      return docs.sort((a, b) => a.position - b.position);
    },
    enabled: selectedNodeId != null,
  });

  const documents = selectedNodeId == null ? [] : documentsQuery.data ?? [];
  const categoriesList = data ?? [];

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

  useEffect(() => {
    if (documentModal.open && DOCUMENT_TYPES.length > 0) {
      const currentType = documentForm.getFieldValue("type");
      if (!currentType) {
        documentForm.setFieldsValue({ type: DOCUMENT_TYPES[0].value });
      }
    }
  }, [documentForm, documentModal.open]);

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

  const handleOpenAddDocument = useCallback(
    (nodeId: number) => {
      const current = lookups.byId.get(nodeId);
      if (current) {
        setSelectionParentId(current.parent_id ?? null);
      } else {
        setSelectionParentId(undefined);
      }
      setSelectedIds([nodeId]);
      setLastSelectedId(nodeId);
      documentForm.resetFields();
      setDocumentModal({ open: true, nodeId });
    },
    [documentForm, lookups, setLastSelectedId, setSelectionParentId, setSelectedIds],
  );
  const handleDocumentSearch = useCallback(
    (values: DocumentFilterFormValues) => {
      const trimmed: DocumentFilterFormValues = {
        ...values,
        docId: values.docId?.trim() || undefined,
        query: values.query?.trim() || undefined,
      };
      setDocumentFilters(trimmed);
    },
    [],
  );

  const handleDocumentReset = useCallback(() => {
    documentFilterForm.resetFields();
    setDocumentFilters({});
  }, [documentFilterForm]);

  const handleEditDocument = useCallback(
    (_doc: Document) => {
      messageApi.info("文档编辑功能即将上线");
    },
    [messageApi],
  );

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
        render: (value: string, record: Document) => (
          <Space>
            <Typography.Text>{value}</Typography.Text>
            {record.deleted_at ? <Tag color="red">已删除</Tag> : null}
          </Space>
        ),
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
        title: "位置",
        dataIndex: "position",
        key: "position",
        width: 80,
        render: (value: number) => (
          <Typography.Text>{value}</Typography.Text>
        ),
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
        width: 80,
        render: (_: unknown, record: Document) => (
          <Tooltip title="编辑文档">
            <Button
              icon={<EditOutlined />}
              type="text"
              shape="circle"
              onClick={() => handleEditDocument(record)}
              aria-label="编辑文档"
            />
          </Tooltip>
        ),
      },
    ],
    [handleEditDocument],
  );

  const documentCreateMutation = useMutation({
    mutationFn: async ({ nodeId, values }: { nodeId: number; values: DocumentFormValues }) => {
      const payload: DocumentCreatePayload = {
        title: values.title.trim(),
        type: values.type,
      };
      if (values.position !== undefined) {
        payload.position = values.position;
      }
      const contentText = values.content?.trim();
      if (contentText) {
        payload.content = { preview: contentText };
      }
      const doc = await createDocument(payload);
      await bindDocument(nodeId, doc.id);
      return doc;
    },
    onSuccess: async (_doc, { nodeId }) => {
      messageApi.success("文档创建成功");
      setDocumentModal({ open: false, nodeId: null });
      documentForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["node-documents", nodeId] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "文档创建失败";
      messageApi.error(msg);
    },
  });

  const handleDocumentModalCancel = useCallback(() => {
    setDocumentModal({ open: false, nodeId: null });
    documentForm.resetFields();
  }, [documentForm]);

  const handleDocumentModalOk = useCallback(() => {
    documentForm
      .validateFields()
      .then((values) => {
        if (!documentModal.nodeId) {
          messageApi.error("请选择要绑定的目录节点");
          return;
        }
        documentCreateMutation.mutate({ nodeId: documentModal.nodeId, values });
      })
      .catch(() => undefined);
  }, [documentForm, documentModal.nodeId, documentCreateMutation, messageApi]);

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
      <DocumentCreateModal
        open={documentModal.open}
        confirmLoading={documentCreateMutation.isPending}
        nodeId={documentModal.nodeId}
        form={documentForm}
        documentTypes={DOCUMENT_TYPES}
        onCancel={handleDocumentModalCancel}
        onOk={handleDocumentModalOk}
      />
      <DocumentReorderModal
        open={reorderModal}
        documents={documents}
        loading={documentReorderMutation.isPending}
        onCancel={() => setReorderModal(false)}
        onConfirm={handleReorderConfirm}
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
