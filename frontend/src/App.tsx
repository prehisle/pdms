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
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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
import { APIKeyManagementDrawer } from "./features/apikeys/APIKeyManagementDrawer";
import { Document, DocumentTrashPage, DocumentVersionsPage } from "./api/documents";
import { CategoryTreePanel } from "./features/categories/components/CategoryTreePanel";
import { CategoryBreadcrumb } from "./features/categories/components/CategoryBreadcrumb";
import { CategoryTrashModal } from "./features/categories/components/CategoryTrashModal";
import { CategoryDeletePreviewModal } from "./features/categories/components/CategoryDeletePreviewModal";
import { CategoryFormModal } from "./features/categories/components/CategoryFormModal";
import { DocumentPanel } from "./features/documents/components/DocumentPanel";
import { DOCUMENT_TYPES } from "./features/documents/constants";
import { DocumentHistoryDrawer } from "./features/documents/components/DocumentHistoryDrawer";
import { DocumentTrashDrawer } from "./features/documents/components/DocumentTrashDrawer";
import { DocumentReorderModal } from "./features/documents/components/DocumentReorderModal";
import { StatusBar } from "./components/StatusBar";
import { useDocumentDrag } from "./features/documents/hooks/useDocumentDrag";

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

const { Header, Sider, Content, Footer } = Layout;
const TREE_MIN_WIDTH = 240;
const TREE_MAX_WIDTH = 600;
const CONTENT_MIN_WIDTH = 320;
const TREE_WIDTH_STORAGE_KEY = "ydms_tree_width";
const TREE_COLLAPSED_STORAGE_KEY = "ydms_tree_collapsed";
const TREE_COLLAPSED_WIDTH = 48;

const AppContent = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const mainLayoutRef = useRef<HTMLDivElement | null>(null);

  // Header 折叠状态
  const [headerCollapsed, setHeaderCollapsed] = useState(() => {
    const saved = localStorage.getItem("ydms_header_collapsed");
    return saved === "true";
  });
  const [treeWidth, setTreeWidth] = useState(() => {
    const saved = localStorage.getItem(TREE_WIDTH_STORAGE_KEY);
    const parsed = saved ? Number.parseInt(saved, 10) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, TREE_MIN_WIDTH), TREE_MAX_WIDTH);
    }
    return 360;
  });
  const [isResizingTree, setIsResizingTree] = useState(false);
  const [treeCollapsed, setTreeCollapsed] = useState(() => {
    const saved = localStorage.getItem(TREE_COLLAPSED_STORAGE_KEY);
    return saved === "true";
  });

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
    documentListPage,
    documentListSize,
    documentListTotal,
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
    handleDocumentListPageChange,
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
    apiKeyManagementOpen,
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
    handleOpenAPIKeyManagement,
    handleCloseAPIKeyManagement,
  } = useUIContext();

  // 刷新分类和文档查询
  const invalidateAllQueries = useCallback(async () => {
    await Promise.all([
      invalidateCategoryQueries(),
      queryClient.invalidateQueries({ queryKey: ["node-documents"] }),
    ]);
  }, [invalidateCategoryQueries, queryClient]);
  const clampTreeWidth = useCallback((width: number) => {
    const layoutRect = mainLayoutRef.current?.getBoundingClientRect();
    const layoutWidth = layoutRect?.width ?? TREE_MAX_WIDTH;
    const maxWidth = Math.max(
      TREE_MIN_WIDTH,
      Math.min(TREE_MAX_WIDTH, layoutWidth - CONTENT_MIN_WIDTH),
    );
    const clamped = Math.min(Math.max(width, TREE_MIN_WIDTH), maxWidth);
    return Math.round(clamped);
  }, []);
  const handleTreeResize = useCallback(
    (clientX: number) => {
      if (treeCollapsed) {
        return;
      }
      const layoutRect = mainLayoutRef.current?.getBoundingClientRect();
      if (!layoutRect) {
        return;
      }
      const offsetX = clientX - layoutRect.left;
      setTreeWidth(clampTreeWidth(offsetX));
    },
    [clampTreeWidth, treeCollapsed],
  );
  const handleTreeResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (treeCollapsed) {
        return;
      }
      event.preventDefault();
      setIsResizingTree(true);
      handleTreeResize(event.clientX);
    },
    [handleTreeResize, treeCollapsed],
  );
  const handleTreeResizeTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (treeCollapsed) {
        return;
      }
      event.preventDefault();
      setIsResizingTree(true);
      handleTreeResize(event.touches[0].clientX);
    },
    [handleTreeResize, treeCollapsed],
  );

  // 文档拖拽功能
  const { handleDocumentDragStart, handleDocumentDragEnd, handleDropOnNode } = useDocumentDrag({
    selectedNodeId,
    messageApi,
    onInvalidateQueries: invalidateAllQueries,
  });

  useEffect(() => {
    document.title = "资料目录管理";
  }, []);

  // 持久化 Header 折叠状态
  useEffect(() => {
    localStorage.setItem("ydms_header_collapsed", String(headerCollapsed));
  }, [headerCollapsed]);
  useEffect(() => {
    localStorage.setItem(TREE_WIDTH_STORAGE_KEY, String(treeWidth));
  }, [treeWidth]);
  useEffect(() => {
    localStorage.setItem(TREE_COLLAPSED_STORAGE_KEY, String(treeCollapsed));
  }, [treeCollapsed]);

  const handleToggleHeader = useCallback(() => {
    setHeaderCollapsed((prev: boolean) => !prev);
  }, []);
  const handleToggleTreeCollapsed = useCallback(() => {
    setTreeCollapsed((prev) => {
      const next = !prev;
      if (!next) {
        setTreeWidth((prevWidth) => clampTreeWidth(prevWidth));
      }
      return next;
    });
  }, [clampTreeWidth]);
  useEffect(() => {
    setTreeWidth((prev) => clampTreeWidth(prev));
  }, [clampTreeWidth]);
  useEffect(() => {
    const handleWindowResize = () => {
      setTreeWidth((prev) => clampTreeWidth(prev));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [clampTreeWidth]);
  useEffect(() => {
    if (!isResizingTree) {
      return;
    }
    const handleMouseMove = (event: MouseEvent) => {
      handleTreeResize(event.clientX);
    };
    const handleMouseUp = () => {
      setIsResizingTree(false);
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        handleTreeResize(event.touches[0].clientX);
      }
    };
    const handleTouchEnd = () => {
      setIsResizingTree(false);
    };
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [handleTreeResize, isResizingTree]);
  useEffect(() => {
    if (treeCollapsed && isResizingTree) {
      setIsResizingTree(false);
    }
  }, [isResizingTree, treeCollapsed]);

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

  const handleOpenTrashWithRefresh = useCallback(async () => {
    setSelectedTrashRowKeys([]);
    handleOpenTrash();
    await trashQuery.refetch();
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
    async (doc: Document) => {
      try {
        // 1. 获取文档的绑定状态
        const { getDocumentBindingStatus, unbindDocument } = await import("./api/documents");
        const bindingStatus = await getDocumentBindingStatus(doc.id);

        if (bindingStatus.total_bindings > 1) {
          // 2. 文档关联到多个目录，显示选择对话框
          const { Modal } = await import("antd");
          Modal.confirm({
            title: "该文档关联到多个目录",
            content: (
              <>
                <p>
                  文档 <strong>"{doc.title}"</strong> 关联到 <strong>{bindingStatus.total_bindings}</strong> 个目录。
                </p>
                <p>请选择操作：</p>
                <ul>
                  <li>
                    <strong>仅从当前目录移除</strong>：文档在其他目录中仍然可见
                  </li>
                  <li>
                    <strong>从所有目录删除</strong>：文档将被移入回收站，所有目录中都不可见
                  </li>
                </ul>
              </>
            ),
            okText: "仅从当前目录移除",
            cancelText: "从所有目录删除",
            okType: "default",
            cancelButtonProps: { danger: true },
            onOk: async () => {
              // 仅解绑当前节点
              if (selectedNodeId == null) {
                messageApi.error("无法确定当前目录");
                return;
              }
              try {
                await unbindDocument(selectedNodeId, doc.id);
                messageApi.success("已从当前目录移除");
                // 刷新文档列表和分类树
                await invalidateAllQueries();
              } catch (error) {
                messageApi.error("移除失败：" + (error as Error).message);
              }
            },
            onCancel: () => {
              // 删除文档
              deleteDocumentMutation.mutate(doc.id);
            },
          });
        } else {
          // 3. 只有一个绑定，直接软删除
          deleteDocumentMutation.mutate(doc.id);
        }
      } catch (error) {
        messageApi.error("检查文档关系失败：" + (error as Error).message);
      }
    },
    [deleteDocumentMutation, selectedNodeId, messageApi, invalidateAllQueries],
  );

  const handleOpenDocHistoryWrapper = useCallback(
    (doc: Document) => {
      setDocumentHistoryDocId(doc.id);
      handleOpenDocumentHistory(doc.id, doc.title, doc.type);
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
	        ordered_ids: orderedIds,
	      });
	    },
	    [documentReorderMutation, selectedNodeId],
	  );

  const handleBreadcrumbNavigate = useCallback(
    (nodeId: number) => {
      // 选中点击的分类节点
      handleSelectionChange({
        selectedIds: [nodeId],
        selectionParentId: lookups.byId.get(nodeId)?.parent_id ?? null,
        lastSelectedId: nodeId,
      });
    },
    [handleSelectionChange, lookups],
  );

  const handleOpenDocumentTrashWithRefresh = useCallback(async () => {
    handleOpenDocumentTrash();
    // 打开回收站时自动刷新数据
    await documentTrashQuery.refetch();
  }, [handleOpenDocumentTrash, documentTrashQuery]);

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
                <Tooltip title="删除文档">
                  <span style={{ display: "inline-flex" }}>
                    <Button
                      icon={<DeleteOutlined />}
                      type="text"
                      danger
                      shape="circle"
                      loading={deleteDocumentMutation.isPending && deleting}
                      onClick={() => handleSoftDeleteDocument(record)}
                      aria-label="删除文档"
                    />
                  </span>
                </Tooltip>
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
  const isSuperAdmin = user?.role === "super_admin";

  const treeToggleButtonStyle = treeCollapsed
    ? {
        width: 32,
        height: 32,
        position: "absolute" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 20,
      }
    : {
        width: 32,
        height: 32,
        position: "absolute" as const,
        top: 16,
        right: -12,
        zIndex: 20,
      };

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
    ...(isSuperAdmin
      ? [
          {
            key: "apikey-management",
            label: "API Key 管理",
            icon: <KeyOutlined />,
            onClick: () => {
              handleOpenAPIKeyManagement();
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
    <Layout style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {contextHolder}
      <Header
        style={{
          background: "#fff",
          padding: "0 24px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: headerCollapsed ? 0 : 64,
          minHeight: headerCollapsed ? 0 : 64,
          lineHeight: headerCollapsed ? 0 : "64px",
          overflow: "hidden",
          transition: "all 0.3s ease",
          opacity: headerCollapsed ? 0 : 1,
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
      <Layout ref={mainLayoutRef} style={{ flex: 1, overflow: "hidden" }}>
        <Sider
          width={treeWidth}
          collapsedWidth={TREE_COLLAPSED_WIDTH}
          collapsed={treeCollapsed}
          trigger={null}
          style={{
            background: "#fff",
            padding: treeCollapsed ? "0" : "16px",
            borderRight: "1px solid #f0f0f0",
            position: "relative",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: treeCollapsed ? "center" : "stretch",
            justifyContent: treeCollapsed ? "center" : "flex-start",
            gap: treeCollapsed ? 0 : 16,
            overflow: treeCollapsed ? "visible" : "hidden",
          }}
        >
          <Tooltip title={treeCollapsed ? "展开目录树" : "折叠目录树"}>
            <Button
              icon={treeCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              shape="circle"
              type="text"
              aria-label={treeCollapsed ? "展开目录树" : "折叠目录树"}
              onClick={handleToggleTreeCollapsed}
              style={treeToggleButtonStyle}
            />
          </Tooltip>
          {!treeCollapsed && (
            <>
              <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
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
                  onDocumentDrop={handleDropOnNode}
                />
              </div>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="调整目录树宽度"
                onMouseDown={handleTreeResizeStart}
                onTouchStart={handleTreeResizeTouchStart}
                style={{
                  position: "absolute",
                  top: 0,
                  right: -4,
                  width: 8,
                  cursor: "col-resize",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  touchAction: "none",
                }}
              >
                <div
                  style={{
                    width: 2,
                    height: "60%",
                    borderRadius: 2,
                    background: isResizingTree ? "#1677ff" : "transparent",
                  }}
                />
              </div>
            </>
          )}
        </Sider>
        <Content style={{ padding: "24px", overflow: "auto" }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <CategoryBreadcrumb
              selectedNodeId={selectedNodeId}
              lookups={lookups}
              onNavigate={handleBreadcrumbNavigate}
            />
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
              pagination={{
                current: documentListPage,
                pageSize: documentListSize,
                total: documentListTotal,
                onChange: handleDocumentListPageChange,
              }}
              onSearch={handleDocumentSearch}
              onReset={handleDocumentReset}
              onAddDocument={handleToolbarAddDocument}
              onReorderDocuments={handleOpenReorderModalWrapper}
              onOpenTrash={handleOpenDocumentTrashWithRefresh}
              onDocumentDragStart={handleDocumentDragStart}
              onDocumentDragEnd={handleDocumentDragEnd}
              onRowDoubleClick={handleEditDocument}
            />
          </Space>
        </Content>
      </Layout>
      <Footer style={{ padding: 0 }}>
        <StatusBar
          selectedCategory={selectedIds.length === 1 ? lookups.byId.get(selectedIds[0]) ?? null : null}
          selectedCount={selectedIds.length}
          totalCategories={categoriesList?.length ?? 0}
          includeDescendants={includeDescendants}
          userRole={user?.role}
          headerCollapsed={headerCollapsed}
          onToggleHeader={handleToggleHeader}
          userMenuItems={userMenuItems}
          userName={user?.display_name || user?.username}
        />
      </Footer>
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
        documentType={documentHistoryState.docType}
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
      <APIKeyManagementDrawer open={apiKeyManagementOpen} onClose={handleCloseAPIKeyManagement} />
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
