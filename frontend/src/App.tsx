import {
  Avatar,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  KeyOutlined,
  LogoutOutlined,
  RollbackOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Category } from "./api/categories";
import { useAuth } from "./contexts/AuthContext";
import { CategoryProvider, useCategoryContext } from "./contexts/CategoryContext";
import { DocumentProvider, useDocumentContext } from "./contexts/DocumentContext";
import { UIProvider, useUIContext } from "./contexts/UIContext";
import { ChangePasswordModal } from "./features/auth";
import { UserManagementDrawer } from "./features/users/UserManagementDrawer";
import { Document, DocumentTrashPage, DocumentVersionsPage } from "./api/documents";
import { CategoryTreePanel } from "./features/categories/components/CategoryTreePanel";
import { CategoryTrashModal } from "./features/categories/components/CategoryTrashModal";
import { CategoryDeletePreviewModal } from "./features/categories/components/CategoryDeletePreviewModal";
import { CategoryFormModal } from "./features/categories/components/CategoryFormModal";
import { DocumentPanel } from "./features/documents/components/DocumentPanel";
import { DOCUMENT_TYPES } from "./features/documents/constants";
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

const { Header, Sider, Content } = Layout;

const AppContent = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();

  // Category Context
  const {
    categoriesList,
    isLoading,
    isFetching,
    error,
    lookups,
    selectedIds,
    selectionParentId,
    lastSelectedId,
    selectedNodeId,
    categoryForm,
    isMutating,
    setMutating,
    createMutation,
    updateMutation,
    deleteMutation,
    bulkDeleteMutation,
    purgeMutation,
    trashQuery,
    trashItems,
    isTrashInitialLoading,
    selectedTrashRowKeys,
    setSelectedTrashRowKeys,
    isTrashProcessing,
    deletePreview,
    openDeletePreview,
    closeDeletePreview,
    setDeletePreviewLoading,
    handleSelectionChange,
    handleRefreshTree,
    invalidateCategoryQueries,
    handleTrashBulkRestore,
    handleTrashBulkPurge,
  } = useCategoryContext();

  // Document Context
  const {
    documents,
    isDocumentsLoading,
    isDocumentsFetching,
    documentsError,
    documentFilterForm,
    includeDescendants,
    documentTrashParams,
    documentTrashQuery,
    documentHistoryParams,
    documentHistoryDocId,
    documentHistoryQuery,
    deleteDocumentMutation,
    restoreDocumentMutation,
    purgeDocumentMutation,
    documentReorderMutation,
    restoreDocumentVersionMutation,
    deletingDocId,
    restoringDocId,
    purgingDocId,
    restoringVersionNumber,
    handleDocumentSearch,
    handleDocumentReset,
    handleIncludeDescendantsChange,
    handleDocumentTrashSearch,
    handleDocumentTrashPageChange,
    handleDocumentHistoryPageChange,
    handleRefreshDocumentTrash,
    setDocumentHistoryDocId,
  } = useDocumentContext();

  // UI Context
  const {
    trashModalOpen,
    showCreateModal,
    showRenameModal,
    documentEditorState,
    documentTrashOpen,
    documentHistoryState,
    reorderModal,
    changePasswordOpen,
    userManagementOpen,
    handleOpenTrash,
    handleCloseTrash,
    handleOpenCreateModal,
    handleCloseCreateModal,
    handleOpenRenameModal,
    handleCloseRenameModal,
    handleOpenDocumentEditor,
    handleCloseDocumentEditor,
    handleOpenDocumentTrash,
    handleCloseDocumentTrash,
    handleOpenDocumentHistory,
    handleCloseDocumentHistory,
    handleOpenReorderModal,
    handleCloseReorderModal,
    handleOpenChangePassword,
    handleCloseChangePassword,
    handleOpenUserManagement,
    handleCloseUserManagement,
  } = useUIContext();

  useEffect(() => {
    document.title = "资料目录管理";
  }, []);

  // Sync rename modal form values
  useEffect(() => {
    if (showRenameModal && selectedIds.length === 1) {
      const current = lookups.byId.get(selectedIds[0]);
      if (current) {
        categoryForm.setFieldsValue({ name: current.name });
      }
    }
  }, [showRenameModal, selectedIds, lookups, categoryForm]);

  const handleRequestCreate = useCallback(
    (parentId: number | null) => {
      categoryForm.resetFields();
      handleOpenCreateModal(parentId);
    },
    [categoryForm, handleOpenCreateModal],
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
    handleOpenRenameModal();
  }, [categoryForm, lookups, selectedIds, handleOpenRenameModal]);

  const handleRequestDelete = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) {
        return;
      }
      openDeletePreview("soft", ids);
    },
    [openDeletePreview],
  );

  const handleOpenTrashWithRefresh = useCallback(() => {
    setSelectedTrashRowKeys([]);
    handleOpenTrash();
    void trashQuery.refetch();
  }, [setSelectedTrashRowKeys, handleOpenTrash, trashQuery]);

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
            closeDeletePreview();
          },
          onError: (err) => handleError(err, "删除失败，请重试"),
        });
      } else {
        bulkDeleteMutation.mutate(
          { ids: targetIds },
          {
            onSuccess: () => {
              closeDeletePreview();
            },
            onError: (err) => handleError(err, "批量删除失败，请重试"),
          },
        );
      }
    } else {
      const targetId = targetIds[0];
      purgeMutation.mutate(targetId, {
        onSuccess: () => {
          closeDeletePreview();
        },
        onError: (err) => handleError(err, "彻底删除失败，请重试"),
      });
    }
  }, [
    bulkDeleteMutation,
    closeDeletePreview,
    deleteMutation,
    deletePreview,
    messageApi,
    purgeMutation,
    setDeletePreviewLoading,
  ]);

  const handleOpenAddDocument = useCallback(
    (nodeId: number) => {
      handleOpenDocumentEditor({ mode: "create", nodeId });
    },
    [handleOpenDocumentEditor],
  );

  const handleToolbarAddDocument = useCallback(() => {
    if (selectedNodeId == null) {
      messageApi.warning("请选择一个目录节点后再添加文档");
      return;
    }
    handleOpenAddDocument(selectedNodeId);
  }, [handleOpenAddDocument, messageApi, selectedNodeId]);

  const handleEditDocument = useCallback(
    (doc: Document) => {
      handleOpenDocumentEditor({
        mode: "edit",
        docId: doc.id,
        nodeId: selectedNodeId ?? undefined,
      });
    },
    [selectedNodeId, handleOpenDocumentEditor],
  );

  const handleSoftDeleteDocument = useCallback(
    (doc: Document) => {
      deleteDocumentMutation.mutate(doc.id);
    },
    [deleteDocumentMutation],
  );

  const handleOpenDocHistoryWrapper = useCallback(
    (doc: Document) => {
      setDocumentHistoryDocId(doc.id);
      handleOpenDocumentHistory(doc.id, doc.title);
    },
    [handleOpenDocumentHistory, setDocumentHistoryDocId],
  );

  const handleCloseDocumentHistoryWrapper = useCallback(() => {
    setDocumentHistoryDocId(null);
    handleCloseDocumentHistory();
  }, [handleCloseDocumentHistory, setDocumentHistoryDocId]);

  const handleOpenReorderModalWrapper = useCallback(() => {
    if (selectedNodeId == null || documents.length <= 1) {
      return;
    }
    handleOpenReorderModal();
  }, [documents.length, selectedNodeId, handleOpenReorderModal]);

  const handleReorderConfirm = useCallback(
    (orderedIds: number[]) => {
      if (selectedNodeId == null) {
        return;
      }
      documentReorderMutation.mutate({
        node_id: selectedNodeId,
        ordered_ids: orderedIds,
      });
    },
    [documentReorderMutation, selectedNodeId],
  );

  // Sync document editor close with deletion
  useEffect(() => {
    if (deletingDocId && documentEditorState.open && documentEditorState.docId === deletingDocId) {
      handleCloseDocumentEditor();
    }
  }, [deletingDocId, documentEditorState, handleCloseDocumentEditor]);

  // Close reorder modal on success
  useEffect(() => {
    if (documentReorderMutation.isSuccess) {
      handleCloseReorderModal();
    }
  }, [documentReorderMutation.isSuccess, handleCloseReorderModal]);

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
        render: (value: string | undefined) => <Typography.Text>{value || "-"}</Typography.Text>,
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
              {user?.role !== "proofreader" && (
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
              )}
              <Tooltip title="历史版本">
                <Button
                  icon={<HistoryOutlined />}
                  type="text"
                  shape="circle"
                  onClick={() => handleOpenDocHistoryWrapper(record)}
                  aria-label="查看历史版本"
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    [
      user,
      deleteDocumentMutation.isPending,
      deletingDocId,
      handleEditDocument,
      handleOpenDocHistoryWrapper,
      handleSoftDeleteDocument,
    ],
  );

  const trashTableColumns = useMemo(
    () =>
      buildTrashColumns(
        false,
        false,
        (id: number) => {
          /* handled by mutation */
        },
        (id: number) => {
          /* handled by mutation */
        },
      ),
    [],
  );

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "超级管理员";
      case "course_admin":
        return "课程管理员";
      case "proofreader":
        return "校对员";
      default:
        return role;
    }
  };

  const canManageUsers = user?.role === "super_admin";

  const userMenuItems: MenuProps["items"] = [
    {
      key: "user-info",
      label: (
        <div>
          <div style={{ fontWeight: 500 }}>{user?.display_name || user?.username}</div>
          <div style={{ fontSize: "12px", color: "#999" }}>{getRoleLabel(user?.role || "")}</div>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" },
    ...(canManageUsers
      ? [
          {
            key: "user-management",
            label: "用户管理",
            icon: <TeamOutlined />,
            onClick: () => {
              handleOpenUserManagement();
            },
          },
        ]
      : []),
    {
      key: "change-password",
      label: "修改密码",
      icon: <KeyOutlined />,
      onClick: () => {
        handleOpenChangePassword();
      },
    },
    {
      key: "logout",
      label: "退出登录",
      icon: <LogoutOutlined />,
      onClick: async () => {
        try {
          await logout();
          message.success("已退出登录");
          navigate("/login");
        } catch (error) {
          message.error("退出登录失败");
        }
      },
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {contextHolder}
      <Header
        style={{
          background: "#fff",
          padding: "0 24px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: 600 }}>YDMS 资料管理系统</div>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: "pointer" }}>
            <Avatar icon={<UserOutlined />} size="small" />
            <span>{user?.display_name || user?.username}</span>
          </Space>
        </Dropdown>
      </Header>
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
            canManageCategories={user?.role !== "proofreader"}
            canCreateRoot={user?.role === "super_admin"}
            onSelectionChange={handleSelectionChange}
            onRequestCreate={handleRequestCreate}
            onRequestRename={handleRequestRename}
            onRequestDelete={handleRequestDelete}
            onOpenTrash={handleOpenTrashWithRefresh}
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
              isLoading={isDocumentsLoading}
              isFetching={isDocumentsFetching}
              error={documentsError}
              canCreateDocument={user?.role !== "proofreader"}
              onSearch={handleDocumentSearch}
              onReset={handleDocumentReset}
              onAddDocument={handleToolbarAddDocument}
              onReorderDocuments={handleOpenReorderModalWrapper}
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
        onSelectedRowKeysChange={(keys) => setSelectedTrashRowKeys(keys)}
        onRefresh={() => {
          void trashQuery.refetch();
        }}
        onClose={handleCloseTrash}
        onBulkRestore={handleTrashBulkRestore}
        onBulkPurge={handleTrashBulkPurge}
        isMutating={isTrashProcessing}
        onClearSelection={() => setSelectedTrashRowKeys([])}
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
                docId={
                  documentEditorState.mode === "edit" ? documentEditorState.docId ?? undefined : undefined
                }
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
        onCancel={handleCloseReorderModal}
        onConfirm={handleReorderConfirm}
      />
      <DocumentTrashDrawer
        open={documentTrashOpen}
        loading={documentTrashQuery.isLoading || documentTrashQuery.isFetching}
        data={documentTrashQuery.data as DocumentTrashPage | undefined}
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
        data={(documentHistoryQuery.data ?? undefined) as DocumentVersionsPage | undefined}
        error={documentHistoryQuery.error}
        onClose={handleCloseDocumentHistoryWrapper}
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
        onCancel={closeDeletePreview}
        onConfirm={handleConfirmDelete}
      />
      <CategoryFormModal
        open={showCreateModal.open}
        title={showCreateModal.parentId ? "新建子目录" : "新建根目录"}
        confirmLoading={createMutation.isPending}
        form={categoryForm}
        onCancel={handleCloseCreateModal}
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
                    handleCloseCreateModal();
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
        onCancel={handleCloseRenameModal}
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
                    handleCloseRenameModal();
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
      <ChangePasswordModal open={changePasswordOpen} onClose={handleCloseChangePassword} />
      <UserManagementDrawer open={userManagementOpen} onClose={handleCloseUserManagement} />
    </Layout>
  );
};

const AppWithProviders = () => {
  const [messageApi] = message.useMessage();
  const categoryContext = useCategoryContext();

  return (
    <DocumentProvider messageApi={messageApi} selectedNodeId={categoryContext.selectedNodeId}>
      <AppContent />
    </DocumentProvider>
  );
};

const App = () => {
  const [messageApi] = message.useMessage();

  return (
    <UIProvider>
      <CategoryProvider messageApi={messageApi}>
        <AppWithProviders />
      </CategoryProvider>
    </UIProvider>
  );
};

// Helper function preserved from original
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

export default App;
