import { useCallback, useEffect, useMemo, useState } from "react";
import type { Key, MouseEvent as ReactMouseEvent, DragEvent as ReactDragEvent } from "react";

import { Alert, Empty, Menu, Spin, Tag, Tree, Typography } from "antd";
import type { MenuProps, TreeProps } from "antd";
import type { MessageInstance } from "antd/es/message/interface";
import {
  ClearOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileAddOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  PlusSquareOutlined,
  EditOutlined,
} from "@ant-design/icons";

import type { Category } from "../../../api/categories";
import { CategoryTreeToolbar } from "./CategoryTreeToolbar";
import type { CategoryLookups, ParentKey, TreeDataNode } from "../types";
import { buildFilteredTree, getParentId } from "../utils";
import { useCategoryClipboard } from "../hooks/useCategoryClipboard";
import { useCategoryContextMenu } from "../hooks/useCategoryContextMenu";
import { useTreePaste } from "../hooks/useTreePaste";
import { useTreeDrag } from "../hooks/useTreeDrag";

type AntTreeProps = TreeProps<TreeDataNode>;
type TreeRightClickInfo = Parameters<NonNullable<AntTreeProps["onRightClick"]>>[0];
type TreeSelectInfo = Parameters<NonNullable<AntTreeProps["onSelect"]>>[1];

export interface CategoryTreePanelProps {
  categories: Category[] | undefined;
  lookups: CategoryLookups;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  isMutating: boolean;
  selectedIds: number[];
  selectionParentId: ParentKey | undefined;
  lastSelectedId: number | null;
  selectedNodeId: number | null;
  includeDescendants: boolean;
  createLoading: boolean;
  trashIsFetching: boolean;
  messageApi: MessageInstance;
  dragDebugEnabled: boolean;
  menuDebugEnabled: boolean;
  canManageCategories?: boolean; // 是否有权限管理分类（创建、编辑、删除）
  canCreateRoot?: boolean; // 是否可以创建根节点
  onSelectionChange: (payload: {
    selectedIds: number[];
    selectionParentId: ParentKey | undefined;
    lastSelectedId: number | null;
  }) => void;
  onRequestCreate: (parentId: number | null) => void;
  onRequestRename: () => void;
  onRequestDelete: (ids: number[]) => void;
  onOpenTrash: () => void;
  onOpenAddDocument: (nodeId: number) => void;
  onIncludeDescendantsChange: (value: boolean) => void;
  onRefresh: () => void;
  onInvalidateQueries: () => Promise<void>;
  setIsMutating: (value: boolean) => void;
  onDocumentDrop?: (targetNodeId: number, dragData: any) => void;
}

export function CategoryTreePanel({
  categories,
  lookups,
  isLoading,
  isFetching,
  error,
  isMutating,
  selectedIds,
  selectionParentId,
  lastSelectedId,
  selectedNodeId,
  includeDescendants,
  createLoading,
  trashIsFetching,
  messageApi,
  dragDebugEnabled,
  menuDebugEnabled,
  canManageCategories = true,
  canCreateRoot = true,
  onSelectionChange,
  onRequestCreate,
  onRequestRename,
  onRequestDelete,
  onOpenTrash,
  onOpenAddDocument,
  onIncludeDescendantsChange,
  onRefresh,
  onInvalidateQueries,
  setIsMutating,
  onDocumentDrop,
}: CategoryTreePanelProps) {
  const [searchValue, setSearchValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [dropTargetNodeId, setDropTargetNodeId] = useState<number | null>(null);
  const {
    clipboard,
    clipboardSourceSet,
    copySelection: handleCopySelection,
    cutSelection: handleCutSelection,
    clearClipboard,
    resetClipboard,
  } = useCategoryClipboard({ messageApi, selectedIds, selectionParentId });

  const {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    suppressNativeContextMenu,
    menuContainerRef,
  } = useCategoryContextMenu({ menuDebugEnabled, lookups });

  const effectiveCategories = categories ?? [];
  const filteredTree = useMemo(
    () => buildFilteredTree(effectiveCategories, null, searchValue.trim()),
    [effectiveCategories, searchValue],
  );
  const treeData = filteredTree.nodes;
  const defaultExpandedKeys = useMemo(
    () => getDefaultExpandedKeys(effectiveCategories, 3),
    [effectiveCategories],
  );

  useEffect(() => {
    if (searchValue.trim()) {
      setExpandedKeys(Array.from(filteredTree.matchedKeys));
      setAutoExpandParent(true);
    }
  }, [filteredTree.matchedKeys, searchValue]);

  useEffect(() => {
    if (!searchValue.trim() && effectiveCategories.length > 0) {
      setExpandedKeys((prev) =>
        prev.length === 0 ? defaultExpandedKeys : prev,
      );
    }
  }, [effectiveCategories, searchValue, defaultExpandedKeys]);


  useEffect(() => {
    if (!categories || categories.length === 0) {
      if (selectedIds.length > 0 || selectionParentId !== undefined || lastSelectedId !== null) {
        onSelectionChange({ selectedIds: [], selectionParentId: undefined, lastSelectedId: null });
      }
      return;
    }
    const existing = new Set<number>();
    const flatten = (nodes?: Category[]) => {
      if (!nodes) return;
      nodes.forEach((node) => {
        existing.add(node.id);
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      });
    };
    flatten(categories);
    const nextIds = selectedIds.filter((id) => existing.has(id));
    if (
      nextIds.length !== selectedIds.length ||
      (nextIds.length > 0 && selectionParentId !== (lookups.byId.get(nextIds[0])?.parent_id ?? null))
    ) {
      const first = nextIds[0];
      const parentId = first != null ? lookups.byId.get(first)?.parent_id ?? null : undefined;
      onSelectionChange({
        selectedIds: nextIds,
        selectionParentId: parentId ?? (nextIds.length === 0 ? undefined : parentId),
        lastSelectedId: nextIds.length > 0 ? nextIds[nextIds.length - 1] : null,
      });
    }
  }, [categories, lookups.byId, selectedIds, selectionParentId, lastSelectedId, onSelectionChange]);

  const isDescendantOrSelf = useCallback(
    (nodeId: number | null, sourceSet: Set<number>) => {
      if (nodeId == null) {
        return false;
      }
      const visited = new Set<number>();
      let current = lookups.byId.get(nodeId);
      while (current) {
        if (sourceSet.has(current.id)) {
          return true;
        }
        const parentId = current.parent_id;
        if (parentId == null || visited.has(parentId)) {
          break;
        }
        visited.add(parentId);
        current = lookups.byId.get(parentId);
      }
      return false;
    },
    [lookups.byId],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleSearchSubmit = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleCreateRootClick = useCallback(() => {
    onRequestCreate(null);
  }, [onRequestCreate]);

  const focusNodeSelection = useCallback(
    (nodeId: number) => {
      const node = lookups.byId.get(nodeId);
      const parentId = node?.parent_id ?? null;
      onSelectionChange({
        selectedIds: [nodeId],
        selectionParentId: parentId,
        lastSelectedId: nodeId,
      });
    },
    [lookups.byId, onSelectionChange],
  );

  const handleCreateChild = useCallback(
    (parentId: number) => {
      focusNodeSelection(parentId);
      onRequestCreate(parentId);
    },
    [focusNodeSelection, onRequestCreate],
  );

  const handleRenameNode = useCallback(
    (nodeId: number) => {
      focusNodeSelection(nodeId);
      onRequestRename();
    },
    [focusNodeSelection, onRequestRename],
  );

  const handleDeleteSelection = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) {
        messageApi.warning("请先选择需要删除的目录");
        return;
      }
      const hasChildren = ids.find((id) => {
        const childList = lookups.parentToChildren.get(id) ?? [];
        return childList.length > 0;
      });
      if (hasChildren != null) {
        messageApi.error("无法删除含子节点的目录");
        return;
      }
      onRequestDelete(ids);
    },
    [lookups.parentToChildren, messageApi, onRequestDelete],
  );

  const { handlePasteAsChild, handlePasteBefore, handlePasteAfter } = useTreePaste({
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
  });

  const handleNodeDragOver = useCallback((event: ReactDragEvent<HTMLSpanElement>, nodeId: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setDropTargetNodeId(nodeId);
  }, []);

  const handleNodeDragLeave = useCallback((event: ReactDragEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTargetNodeId(null);
  }, []);

  const handleNodeDrop = useCallback(
    (event: ReactDragEvent<HTMLSpanElement>, nodeId: number) => {
      event.preventDefault();
      event.stopPropagation();
      setDropTargetNodeId(null);

      try {
        const data = event.dataTransfer.getData("application/json");
        if (!data) {
          return;
        }

        const dragData = JSON.parse(data);
        if (dragData.type === "document" && onDocumentDrop) {
          onDocumentDrop(nodeId, dragData);
        }
      } catch (error) {
        messageApi.error("拖放失败：数据格式错误");
      }
    },
    [messageApi, onDocumentDrop],
  );

  const renderTreeTitle = useCallback(
    (node: TreeDataNode) => {
      const nodeId = Number(node.key);
      const isCutNode = clipboard?.mode === "cut" && clipboardSourceSet.has(nodeId);
      const isDropTarget = dropTargetNodeId === nodeId;

      return (
        <span
          style={{
            opacity: isCutNode ? 0.5 : 1,
            backgroundColor: isDropTarget ? "#e6f7ff" : "transparent",
            padding: "2px 8px",
            borderRadius: 4,
            display: "inline-block",
            width: "100%",
          }}
          onDragOver={(e) => handleNodeDragOver(e, nodeId)}
          onDragLeave={handleNodeDragLeave}
          onDrop={(e) => handleNodeDrop(e, nodeId)}
        >
          {node.title as string}
        </span>
      );
    },
    [clipboard, clipboardSourceSet, dropTargetNodeId, handleNodeDragOver, handleNodeDragLeave, handleNodeDrop],
  );

  const handleTreeRightClick = useCallback<NonNullable<AntTreeProps["onRightClick"]>>(
    (info) => {
      const { event, node } = info as TreeRightClickInfo;
      const mouseEvent = event as ReactMouseEvent;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      if (typeof mouseEvent.nativeEvent?.preventDefault === "function") {
        mouseEvent.nativeEvent.preventDefault();
      }
      const nodeId = Number(node.key);
      const parentId = getParentId(node);
      const normalizedParent = parentId ?? null;

      if (!selectedIds.includes(nodeId)) {
        onSelectionChange({
          selectedIds: [nodeId],
          selectionParentId: normalizedParent,
          lastSelectedId: nodeId,
        });
      } else if (selectionParentId !== normalizedParent) {
        onSelectionChange({
          selectedIds,
          selectionParentId: normalizedParent,
          lastSelectedId,
        });
      }

      openContextMenu({
        nodeId,
        parentId: normalizedParent,
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
      });
    },
    [selectedIds, selectionParentId, lastSelectedId, onSelectionChange, openContextMenu],
  );

  const contextMenuItems = useMemo<MenuProps["items"]>(() => {
    if (!contextMenu.open || contextMenu.nodeId == null) {
      if (!clipboard) {
        return [];
      }
      return [
        {
          key: "clear-clipboard",
          icon: <ClearOutlined />,
          label: "清空剪贴板",
          onClick: () => {
            closeContextMenu("action:clear-clipboard-fallback");
            clearClipboard();
          },
        },
      ];
    }

    const nodeId = contextMenu.nodeId;
    const nodeParentId = contextMenu.parentId;
    const selectionIncludesNode = selectedIds.includes(nodeId);
    const resolvedSelectionParent =
      selectionIncludesNode && selectionParentId !== undefined
        ? selectionParentId
        : contextMenu.parentId;
    const resolvedSelectionIds = selectionIncludesNode ? selectedIds : [nodeId];
    const resolvedSelectionAvailable =
      resolvedSelectionParent !== undefined && resolvedSelectionIds.length > 0;
    const contextCanCopy = !isMutating && resolvedSelectionAvailable;

    const items: MenuProps["items"] = [];

    if (canManageCategories) {
      items.push({
        key: "add-document",
        icon: <FileAddOutlined />,
        label: "添加文档",
        onClick: () => {
          closeContextMenu("action:add-document");
          onOpenAddDocument(nodeId);
        },
      });
    }

    if (resolvedSelectionAvailable) {
      if (canManageCategories && resolvedSelectionIds.length === 1) {
        const targetId = resolvedSelectionIds[0];
        items.push(
          {
            key: "create-child",
            icon: <PlusSquareOutlined />,
            label: "新建子目录",
            disabled: isMutating,
            onClick: () => {
              closeContextMenu("action:create-child");
              handleCreateChild(targetId);
            },
          },
          {
            key: "rename-node",
            icon: <EditOutlined />,
            label: "重命名目录",
            disabled: isMutating,
            onClick: () => {
              closeContextMenu("action:rename-node");
              handleRenameNode(targetId);
            },
          },
        );
      }
      if (canManageCategories) {
        items.push({
          key: "copy-selection",
          icon: <CopyOutlined />,
          label: "复制所选",
          disabled: !contextCanCopy,
          onClick: () => {
            closeContextMenu("action:copy-selection");
            handleCopySelection({
              ids: resolvedSelectionIds,
              parentId: resolvedSelectionParent ?? null,
            });
          },
        });
        items.push(
          {
            key: "cut-selection",
            icon: <ScissorOutlined />,
            label: "剪切所选",
            disabled: !contextCanCopy,
            onClick: () => {
              closeContextMenu("action:cut-selection");
              handleCutSelection({
                ids: resolvedSelectionIds,
                parentId: resolvedSelectionParent ?? null,
              });
            },
          },
          {
            key: "delete-node",
            icon: <DeleteOutlined />,
            label: "删除目录",
            disabled: resolvedSelectionIds.length === 0 || isMutating,
            onClick: () => {
              closeContextMenu("action:delete-node");
              handleDeleteSelection(resolvedSelectionIds);
            },
          },
        );
      }
    }

    if (clipboard && canManageCategories) {
      items.push({ type: "divider" });
      items.push(
        {
          key: "paste-child",
          icon: clipboard.mode === "cut" ? <ScissorOutlined /> : <SnippetsOutlined />,
          label: clipboard.mode === "cut" ? "剪切到该节点" : "粘贴为子节点",
          disabled: isMutating || isDescendantOrSelf(nodeId, clipboardSourceSet),
          onClick: () => {
            closeContextMenu("action:paste-child");
            handlePasteAsChild(nodeId);
          },
        },
        {
          key: "paste-before",
          icon: <SnippetsOutlined />,
          label: clipboard.mode === "cut" ? "剪切到此前" : "粘贴到此前",
          disabled:
            isMutating ||
            clipboardSourceSet.has(nodeId) ||
            isDescendantOrSelf(nodeParentId, clipboardSourceSet),
          onClick: () => {
            closeContextMenu("action:paste-before");
            handlePasteBefore(nodeId);
          },
        },
        {
          key: "paste-after",
          icon: <SnippetsOutlined />,
          label: clipboard.mode === "cut" ? "剪切到此后" : "粘贴到此后",
          disabled:
            isMutating ||
            clipboardSourceSet.has(nodeId) ||
            isDescendantOrSelf(nodeParentId, clipboardSourceSet),
          onClick: () => {
            closeContextMenu("action:paste-after");
            handlePasteAfter(nodeId);
          },
        },
      );
      items.push({ type: "divider" });
      items.push({
        key: "clear-clipboard",
        icon: <ClearOutlined />,
        label: "清空剪贴板",
        onClick: () => {
          closeContextMenu("action:clear-clipboard");
          clearClipboard();
        },
      });
    }

    if (menuDebugEnabled) {
      // eslint-disable-next-line no-console
      console.log("[menu-debug] context menu items", {
        nodeId,
        selectionIncludesNode,
        resolvedSelectionIds,
        resolvedSelectionParent,
        count: items.length,
        keys: items.map((item) => {
          if (!item) {
            return null;
          }
          if ("key" in item && item.key) {
            return item.key;
          }
          return item.type ?? null;
        }),
      });
    }

    return items;
  }, [
    canManageCategories,
    clipboard,
    clipboardSourceSet,
    clearClipboard,
    closeContextMenu,
    handleCopySelection,
    handleCutSelection,
    handleCreateChild,
    handleRenameNode,
    handlePasteAfter,
    handlePasteAsChild,
    handlePasteBefore,
    handleDeleteSelection,
    isDescendantOrSelf,
    isMutating,
    menuDebugEnabled,
    onOpenAddDocument,
    selectedIds,
    selectionParentId,
    contextMenu,
  ]);

  const contextMenuVisible = contextMenu.open && (contextMenuItems?.length ?? 0) > 0;

  const { handleDrop } = useTreeDrag({
    lookups,
    messageApi,
    closeContextMenu,
    dragDebugEnabled,
    menuDebugEnabled,
    setIsMutating,
    onRefresh,
    onInvalidateQueries,
  });
  const handleSelect = useCallback<NonNullable<AntTreeProps["onSelect"]>>(
    (_keys, info) => {
      const typedInfo = info as TreeSelectInfo;
      const clickedId = Number(typedInfo.node.key);
      const parentId = getParentId(typedInfo.node);
      const normalizedParent = parentId ?? null;
      const nativeEvent = typedInfo.nativeEvent as MouseEvent | undefined;
      const isShift = nativeEvent?.shiftKey ?? false;
      const isMeta = nativeEvent ? nativeEvent.metaKey || nativeEvent.ctrlKey : false;

      if (typedInfo.selected) {
        if (
          selectionParentId !== undefined &&
          selectionParentId !== normalizedParent &&
          (selectedIds.length > 1 || isMeta || isShift)
        ) {
          messageApi.warning("仅支持同一父节点下的多选");
          return;
        }

        if (
          selectionParentId !== undefined &&
          selectionParentId !== normalizedParent &&
          !isMeta &&
          !isShift
        ) {
          onSelectionChange({
            selectedIds: [clickedId],
            selectionParentId: normalizedParent,
            lastSelectedId: clickedId,
          });
          return;
        }

        let nextIds = selectedIds;
        if (!isMeta && !isShift) {
          nextIds = [clickedId];
        } else if (isShift && lastSelectedId != null && selectionParentId !== undefined) {
          const siblings = lookups.parentToChildren.get(normalizedParent) ?? [];
          const order = siblings.map((node) => node.id);
          const lastIndex = order.indexOf(lastSelectedId);
          const currentIndex = order.indexOf(clickedId);
          if (lastIndex !== -1 && currentIndex !== -1) {
            const [start, end] = [
              Math.min(lastIndex, currentIndex),
              Math.max(lastIndex, currentIndex),
            ];
            const rangeSet = new Set<number>(nextIds);
            for (let i = start; i <= end; i += 1) {
              rangeSet.add(order[i]);
            }
            nextIds = Array.from(rangeSet).sort((a, b) => order.indexOf(a) - order.indexOf(b));
          }
        } else if (isMeta) {
          const set = new Set<number>(nextIds);
          if (set.has(clickedId)) {
            set.delete(clickedId);
          } else {
            set.add(clickedId);
          }
          nextIds = Array.from(set);
        }
        onSelectionChange({
          selectedIds: nextIds,
          selectionParentId: normalizedParent,
          lastSelectedId: clickedId,
        });
      } else {
        const set = new Set<number>(selectedIds);
        set.delete(clickedId);
        const nextIds = Array.from(set);
        const nextParent = nextIds.length === 0 ? undefined : normalizedParent;
        onSelectionChange({
          selectedIds: nextIds,
          selectionParentId: nextParent,
          lastSelectedId,
        });
      }
    },
    [
      lastSelectedId,
      lookups.parentToChildren,
      messageApi,
      onSelectionChange,
      selectedIds,
      selectionParentId,
    ],
  );

  return (
    <div>
      {contextMenuVisible ? (
        <div
          ref={menuContainerRef}
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1050,
            background: "#fff",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
            minWidth: 160,
            overflow: "hidden",
          }}
        >
          <Menu
            selectable={false}
            items={contextMenuItems}
            onClick={({ domEvent }) => {
              domEvent.stopPropagation();
              domEvent.preventDefault();
            }}
          />
        </div>
      ) : null}
      <CategoryTreeToolbar
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onRefresh={onRefresh}
        onCreateRoot={handleCreateRootClick}
        onOpenTrash={onOpenTrash}
        includeDescendants={includeDescendants}
        onIncludeDescendantsChange={onIncludeDescendantsChange}
        isRefreshing={isFetching || isMutating}
        createLoading={createLoading}
        trashIsFetching={trashIsFetching}
        selectedNodeId={selectedNodeId}
        canCreate={canCreateRoot}
      />
      {clipboard ? (
        <Tag color={clipboard.mode === "cut" ? "orange" : "blue"} style={{ marginBottom: 16 }}>
          剪贴板：{clipboard.mode === "cut" ? "剪切" : "复制"} {clipboard.sourceIds.length} 项
        </Tag>
      ) : null}
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
          <Spin />
        </div>
      ) : error ? (
        <Alert
          type="error"
          message="目录树加载失败"
          description={(error as Error).message}
        />
      ) : treeData.length === 0 ? (
        <Empty description="暂无目录" />
      ) : (
        <div onContextMenuCapture={suppressNativeContextMenu}>
          <Tree<TreeDataNode>
            blockNode
            draggable={{ icon: false }}
            showLine={{ showLeafIcon: false }}
            multiple
            treeData={treeData}
            titleRender={renderTreeTitle}
            onDrop={handleDrop}
            selectedKeys={selectedIds.map(String)}
            onSelect={handleSelect}
            onRightClick={handleTreeRightClick}
            expandedKeys={expandedKeys}
            autoExpandParent={autoExpandParent}
            onExpand={(keys) => {
              setExpandedKeys(keys.map(String));
              setAutoExpandParent(false);
            }}
            height={600}
            style={{ userSelect: "none" }}
          />
        </div>
      )}
    </div>
  );
}

function getDefaultExpandedKeys(nodes: Category[], maxDepth: number): string[] {
  if (!Array.isArray(nodes) || nodes.length === 0 || maxDepth <= 0) {
    return [];
  }
  const collected = new Set<string>();
  const traverse = (items: Category[] | undefined, depth: number) => {
    if (!items || depth >= maxDepth) {
      return;
    }
    items.forEach((item) => {
      collected.add(item.id.toString());
      if (item.children && item.children.length > 0) {
        traverse(item.children, depth + 1);
      }
    });
  };
  traverse(nodes, 0);
  return Array.from(collected);
}
