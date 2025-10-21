import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tree,
  Typography,
  message,
} from "antd";
import type { TreeProps } from "antd";
import type { DataNode, EventDataNode } from "antd/es/tree";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import {
  Category,
  CategoryCreatePayload,
  CategoryUpdatePayload,
  createCategory,
  deleteCategory,
  getDeletedCategories,
  getCategoryTree,
  purgeCategory,
  repositionCategory,
  restoreCategory,
  updateCategory,
  bulkRestoreCategories,
  bulkPurgeCategories,
} from "./api/categories";

const dragDebugEnabled =
  (import.meta.env.VITE_DEBUG_DRAG ?? "").toString().toLowerCase() === "1";

const { Header, Sider, Content } = Layout;

type TreeDataNode = DataNode & {
  parentId: number | null;
  children?: TreeDataNode[];
};

type ParentKey = number | null;

const App = () => {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["categories-tree"],
    queryFn: () => getCategoryTree(),
  });
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<"tree" | "trash">("tree");
  const [showCreateModal, setShowCreateModal] = useState<{
    open: boolean;
    parentId: number | null;
  }>({ open: false, parentId: null });
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [form] = Form.useForm<{ name: string }>();
  const [searchValue, setSearchValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [selectedTrashRowKeys, setSelectedTrashRowKeys] = useState<Key[]>([]);

  const trashQuery = useQuery({
    queryKey: ["categories-trash"],
    queryFn: () => getDeletedCategories(),
    enabled: activeTab === "trash",
  });

  useEffect(() => {
    if (activeTab === "trash") {
      setSelectedId(null);
    }
  }, [activeTab]);

  const createMutation = useMutation({
    mutationFn: (payload: CategoryCreatePayload) => createCategory(payload),
    onSuccess: async () => {
      messageApi.success("目录创建成功");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories-tree"] }),
        queryClient.invalidateQueries({ queryKey: ["categories-trash"] }),
      ]);
      setShowCreateModal({ open: false, parentId: null });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "目录创建失败";
      messageApi.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CategoryUpdatePayload }) =>
      updateCategory(id, payload),
    onSuccess: async () => {
      messageApi.success("目录更新成功");
      await queryClient.invalidateQueries({ queryKey: ["categories-tree"] });
      setShowRenameModal(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "目录更新失败";
      messageApi.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: async () => {
      messageApi.success("目录删除成功");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories-tree"] }),
        queryClient.invalidateQueries({ queryKey: ["categories-trash"] }),
      ]);
      setSelectedId(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "目录删除失败";
      messageApi.error(msg);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreCategory(id),
    onSuccess: async () => {
      messageApi.success("目录已恢复");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories-tree"] }),
        queryClient.invalidateQueries({ queryKey: ["categories-trash"] }),
      ]);
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
      await queryClient.invalidateQueries({ queryKey: ["categories-trash"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "彻底删除失败";
      messageApi.error(msg);
    },
  });

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

  const filteredTree = useMemo(() => {
    if (!data) {
      return { nodes: [] as TreeDataNode[], matchedKeys: new Set<string>() };
    }
    return buildFilteredTree(data, null, searchValue.trim());
  }, [data, searchValue]);

  const treeData = filteredTree.nodes;

  const lookups = useMemo(() => buildLookups(data ?? []), [data]);

  useEffect(() => {
    if (searchValue.trim()) {
      setExpandedKeys(Array.from(filteredTree.matchedKeys));
      setAutoExpandParent(true);
    }
  }, [filteredTree.matchedKeys, searchValue]);

  useEffect(() => {
    if (!searchValue.trim() && data) {
      setExpandedKeys((prev) =>
        prev.length === 0 ? data.map((node) => node.id.toString()) : prev,
      );
    }
  }, [data, searchValue]);

  const handleDrop = useCallback<NonNullable<TreeProps["onDrop"]>>(
    async (info) => {
      const dragId = Number(info.dragNode.key);
      const dropId = Number(info.node.key);
      const nodePosition = Number(
        (info.node.pos ?? "0").split("-").pop() ?? 0,
      );
      const dropRelative = info.dropPosition - nodePosition;

      const baseParentId = getParentId(info.node);
      let targetParentId: number | null;
      if (info.dropToGap) {
        targetParentId = baseParentId;
      } else if (dropRelative < 0) {
        // Drop above current node; keep same parent
        targetParentId = baseParentId;
      } else {
        targetParentId = dropId;
      }

      const dragCategory = lookups.byId.get(dragId);
      if (!dragCategory) {
        messageApi.error("拖拽节点信息缺失，无法完成操作");
        return;
      }

      const sourceParentId = getParentId(info.dragNode);

      // Prepare new ordering
      const targetSiblingsBaseline =
        lookups.parentToChildren.get(targetParentId) ?? [];

      const orderedWithoutDrag = targetSiblingsBaseline.filter(
        (item) => item.id !== dragId,
      );

      let insertIndex = orderedWithoutDrag.length;
      const dropOnSameParentTop =
        !info.dropToGap &&
        dropRelative === 0 &&
        sourceParentId !== null &&
        Number(info.node.key) === sourceParentId;
      if (dropOnSameParentTop) {
        insertIndex = 0;
      }

      if (info.dropToGap) {
        const targetIndex = orderedWithoutDrag.findIndex(
          (item) => item.id === dropId,
        );
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
          dropPosition: info.dropPosition,
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
        await refetch();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "调整目录顺序失败，请重试";
        messageApi.error(msg);
      } finally {
        setIsMutating(false);
      }
    },
    [lookups, messageApi, refetch],
  );

  const handleBulkRestore = useCallback(async () => {
    if (selectedTrashRowKeys.length === 0) {
      return;
    }
    const ids = selectedTrashRowKeys.map((key) => Number(key));
    setIsMutating(true);
    try {
      await bulkRestoreCategories({ ids });
      messageApi.success(`已恢复 ${ids.length} 个目录`);
      setSelectedTrashRowKeys([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories-tree"] }),
        trashQuery.refetch(),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "批量恢复失败，请重试";
      messageApi.error(msg);
    } finally {
      setIsMutating(false);
    }
  }, [messageApi, queryClient, selectedTrashRowKeys, trashQuery]);

  const handleBulkPurge = useCallback(async () => {
    if (selectedTrashRowKeys.length === 0) {
      return;
    }
    const ids = selectedTrashRowKeys.map((key) => Number(key));
    setIsMutating(true);
    try {
      await bulkPurgeCategories({ ids });
      messageApi.success(`已彻底删除 ${ids.length} 个目录`);
      setSelectedTrashRowKeys([]);
      await trashQuery.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "批量彻底删除失败，请重试";
      messageApi.error(msg);
    } finally {
      setIsMutating(false);
    }
  }, [messageApi, selectedTrashRowKeys, trashQuery]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {contextHolder}
      <Header style={{ display: "flex", alignItems: "center" }}>
        <Typography.Title level={3} style={{ color: "#fff", margin: 0 }}>
          题库目录管理
        </Typography.Title>
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
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as "tree" | "trash")}
            items={[
              {
                key: "tree",
                label: "目录树",
                children: (
                  <>
                    <Space style={{ marginBottom: 16 }} wrap>
                      <Input.Search
                        placeholder="搜索目录"
                        allowClear
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onSearch={(val) => setSearchValue(val)}
                        style={{ width: 200 }}
                      />
                      <Button onClick={() => refetch()} loading={isFetching || isMutating}>
                        刷新目录
                      </Button>
                      <Button
                        type="primary"
                        onClick={() => {
                          form.resetFields();
                          setShowCreateModal({ open: true, parentId: null });
                        }}
                        loading={createMutation.isPending}
                      >
                        新建根目录
                      </Button>
                      <Button
                        onClick={() => {
                          form.resetFields();
                          setShowCreateModal({ open: true, parentId: selectedId });
                        }}
                        disabled={selectedId === null}
                        loading={createMutation.isPending}
                      >
                        新建子目录
                      </Button>
                      <Button
                        onClick={() => {
                          const current = selectedId ? lookups.byId.get(selectedId) : null;
                          if (!current) return;
                          form.setFieldsValue({ name: current.name });
                          setShowRenameModal(true);
                        }}
                        disabled={!selectedId}
                        loading={updateMutation.isPending}
                      >
                        重命名
                      </Button>
                      <Popconfirm
                        title="确认删除该目录？"
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => selectedId && deleteMutation.mutate(selectedId)}
                        disabled={!selectedId}
                      >
                        <Button danger disabled={!selectedId} loading={deleteMutation.isPending}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
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
                      <Tree
                        blockNode
                        draggable={{ icon: false }}
                        showLine={{ showLeafIcon: false }}
                        treeData={treeData}
                        onDrop={handleDrop}
                        selectedKeys={selectedId ? [selectedId.toString()] : []}
                        onSelect={(keys) => {
                          const key = keys[0];
                          setSelectedId(key ? Number(key) : null);
                        }}
                        expandedKeys={expandedKeys}
                        autoExpandParent={autoExpandParent}
                        onExpand={(keys) => {
                          setExpandedKeys(keys.map(String));
                          setAutoExpandParent(false);
                        }}
                        height={600}
                        style={{ userSelect: "none" }}
                      />
                    )}
                  </>
                ),
              },
              {
                key: "trash",
                label: "回收站",
                children: (
                  <>
                    {trashQuery.isLoading ? (
                      <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
                        <Spin />
                      </div>
                    ) : trashQuery.error ? (
                      <Alert
                        type="error"
                        message="回收站加载失败"
                        description={(trashQuery.error as Error).message}
                      />
                    ) : (
                      <>
                        <Space style={{ marginBottom: 16 }} wrap>
                          <Button
                            type="primary"
                            onClick={() => trashQuery.refetch()}
                            loading={trashQuery.isFetching || isMutating}
                          >
                            刷新回收站
                          </Button>
                          <Button
                            onClick={handleBulkRestore}
                            disabled={selectedTrashRowKeys.length === 0}
                            loading={isMutating}
                          >
                            批量恢复
                          </Button>
                          <Popconfirm
                            title={`确认彻底删除选中的 ${selectedTrashRowKeys.length} 个目录？`}
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true, disabled: selectedTrashRowKeys.length === 0 }}
                            onConfirm={handleBulkPurge}
                            disabled={selectedTrashRowKeys.length === 0}
                          >
                            <Button
                              danger
                              disabled={selectedTrashRowKeys.length === 0}
                              loading={isMutating}
                            >
                              批量彻底删除
                            </Button>
                          </Popconfirm>
                          <Button
                            onClick={() => setSelectedTrashRowKeys([])}
                            disabled={selectedTrashRowKeys.length === 0}
                          >
                            清空选择
                          </Button>
                        </Space>
                        {(trashQuery.data ?? []).length === 0 ? (
                          <Empty description="暂无已删除目录" />
                        ) : (
                          <Table
                            rowKey="id"
                            pagination={false}
                            dataSource={trashQuery.data ?? []}
                            columns={trashTableColumns}
                            rowSelection={{
                              selectedRowKeys: selectedTrashRowKeys,
                              onChange: (keys) => setSelectedTrashRowKeys(keys),
                            }}
                          />
                        )}
                      </>
                    )}
                  </>
                ),
              },
            ]}
          />
        </Sider>
        <Content style={{ padding: "24px" }}>
          <Typography.Title level={4}>目录详情</Typography.Title>
          {selectedId ? (
            <CategoryDetail category={lookups.byId.get(selectedId) ?? null} />
          ) : (
            <Typography.Paragraph type="secondary">
              请选择一个目录节点查看详情或操作。
            </Typography.Paragraph>
          )}
        </Content>
      </Layout>
      <Modal
        title={showCreateModal.parentId ? "新建子目录" : "新建根目录"}
        open={showCreateModal.open}
        confirmLoading={createMutation.isPending}
        onCancel={() => setShowCreateModal({ open: false, parentId: null })}
        onOk={() => {
          form
            .validateFields()
            .then((values) => {
              createMutation.mutate({
                name: values.name.trim(),
                parent_id: showCreateModal.parentId,
              });
            })
            .catch(() => undefined);
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="目录名称"
            rules={[
              {
                validator: (_, value: string) => {
                  const trimmed = value?.trim() ?? "";
                  if (!trimmed) {
                    return Promise.reject(new Error("请输入目录名称"));
                  }
                  if (trimmed.length > 50) {
                    return Promise.reject(new Error("名称不超过 50 个字符"));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="请输入" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="重命名目录"
        open={showRenameModal}
        confirmLoading={updateMutation.isPending}
        onCancel={() => setShowRenameModal(false)}
        onOk={() => {
          form
            .validateFields()
            .then((values) => {
              if (!selectedId) return;
              updateMutation.mutate({
                id: selectedId,
                payload: { name: values.name.trim() },
              });
            })
            .catch(() => undefined);
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="目录名称"
            rules={[
              {
                validator: (_, value: string) => {
                  const trimmed = value?.trim() ?? "";
                  if (!trimmed) {
                    return Promise.reject(new Error("请输入目录名称"));
                  }
                  if (trimmed.length > 50) {
                    return Promise.reject(new Error("名称不超过 50 个字符"));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input placeholder="请输入" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default App;

function buildFilteredTree(
  nodes: Category[],
  parentId: ParentKey,
  search: string,
) {
  const trimmed = search.toLowerCase();
  if (!trimmed) {
    return { nodes: buildTreeData(nodes, parentId), matchedKeys: new Set<string>() };
  }
  const matchedKeys = new Set<string>();
  const filtered = filterNodes(nodes, parentId, [], matchedKeys, trimmed);
  return { nodes: filtered, matchedKeys };
}

function buildTreeData(
  nodes: Category[],
  parentId: ParentKey,
): TreeDataNode[] {
  const sorted = sortCategories(nodes);
  return sorted.map((node) => ({
    key: node.id.toString(),
    title: node.name,
    parentId,
    children: buildTreeData(node.children ?? [], node.id),
  }));
}

function filterNodes(
  nodes: Category[],
  parentId: ParentKey,
  ancestors: string[],
  matchedKeys: Set<string>,
  search: string,
): TreeDataNode[] {
  const sorted = sortCategories(nodes);
  const result: TreeDataNode[] = [];
  sorted.forEach((node) => {
    const key = node.id.toString();
    const childAncestors = [...ancestors, key];
    const children = filterNodes(node.children ?? [], node.id, childAncestors, matchedKeys, search);
    const nameMatch = node.name.toLowerCase().includes(search);
    const includeNode = nameMatch || children.length > 0;
    if (!includeNode) {
      return;
    }
    if (nameMatch || children.length > 0) {
      matchedKeys.add(key);
      ancestors.forEach((ancestorKey) => matchedKeys.add(ancestorKey));
    }
    result.push({
      key,
      title: node.name,
      parentId,
      children: children.length > 0 ? children : undefined,
    });
  });
  return result;
}

function buildLookups(nodes: Category[]) {
  const byId = new Map<number, Category>();
  const parentToChildren = new Map<ParentKey, Category[]>();

  const walk = (list: Category[], parentId: ParentKey) => {
    const sorted = sortCategories(list);
    parentToChildren.set(parentId, sorted);
    sorted.forEach((node) => {
      byId.set(node.id, node);
      if (node.children && node.children.length > 0) {
        walk(node.children, node.id);
      }
    });
  };

  walk(nodes, null);
  return { byId, parentToChildren };
}

function sortCategories(nodes: Category[]): Category[] {
  return [...nodes].sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position;
    }
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function getParentId(node: EventDataNode<DataNode>): number | null {
  return (node as TreeDataNode & EventDataNode<DataNode>).parentId ?? null;
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
      render: (value: string, record: Category) => (
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
          <Button
            type="link"
            onClick={() => onRestore(record.id)}
            disabled={restoreLoading}
            loading={restoreLoading}
          >
            恢复
          </Button>
          <Popconfirm
            title="彻底删除后无法恢复，确认操作？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => onPurge(record.id)}
            disabled={purgeLoading}
          >
            <Button type="link" danger disabled={purgeLoading} loading={purgeLoading}>
              彻底删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}

interface CategoryDetailProps {
  category: Category | null;
}

function CategoryDetail({ category }: CategoryDetailProps) {
  if (!category) {
    return (
      <Typography.Paragraph type="secondary">
        目录信息已更新，请重新选择节点查看详情。
      </Typography.Paragraph>
    );
  }
  return (
    <Card style={{ maxWidth: 480 }}>
      <Space direction="vertical">
        <Typography.Text strong>名称</Typography.Text>
        <Space>
          <Typography.Text>{category.name}</Typography.Text>
          {category.deleted_at ? <Tag color="red">已删除</Tag> : null}
        </Space>
        <Typography.Text strong>路径</Typography.Text>
        <Typography.Text code>{category.path}</Typography.Text>
        <Typography.Text strong>父级 ID</Typography.Text>
        <Typography.Text>{category.parent_id ?? "根目录"}</Typography.Text>
        <Typography.Text strong>排序位置</Typography.Text>
        <Typography.Text>{category.position}</Typography.Text>
        <Typography.Text strong>创建时间</Typography.Text>
        <Typography.Text>
          {new Date(category.created_at).toLocaleString()}
        </Typography.Text>
        <Typography.Text strong>更新时间</Typography.Text>
        <Typography.Text>
          {new Date(category.updated_at).toLocaleString()}
        </Typography.Text>
        {category.deleted_at ? (
          <>
            <Typography.Text strong>删除时间</Typography.Text>
            <Typography.Text>
              {new Date(category.deleted_at).toLocaleString()}
            </Typography.Text>
          </>
        ) : null}
      </Space>
    </Card>
  );
}
