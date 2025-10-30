import { LinkOutlined, FileTextOutlined, DeleteOutlined, FolderOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Modal, Button, Empty, List, message, Popconfirm, Space, Spin, Typography, Tag, Tree, Input } from "antd";
import type { DataNode } from "antd/es/tree";
import { useState, useEffect } from "react";
import {
  addDocumentReference,
  removeDocumentReference,
  getNodeDocuments,
  type Document,
  type DocumentReference,
} from "../../../api/documents";
import { getCategoryTree, type Category } from "../../../api/categories";

const { Text, Link } = Typography;
const { Search } = Input;

interface PendingReference {
  document_id: number;
  title: string;
}

interface DocumentReferenceModalProps {
  open: boolean;
  onCancel: () => void;
  // 编辑模式：传入现有文档
  document?: Document;
  onDocumentUpdated?: (document: Document) => void;
  // 新建模式：传入待添加的引用列表
  pendingReferences?: PendingReference[];
  onPendingAdd?: (doc: Document) => void;
  onPendingRemove?: (docId: number) => void;
}

export function DocumentReferenceModal({
  open,
  onCancel,
  document,
  onDocumentUpdated,
  pendingReferences,
  onPendingAdd,
  onPendingRemove,
}: DocumentReferenceModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [availableDocs, setAvailableDocs] = useState<Document[]>([]);
  const [searchValue, setSearchValue] = useState("");

  // 确定是编辑模式还是新建模式
  const isEditMode = !!document;
  const references = isEditMode
    ? ((document.metadata?.references as DocumentReference[]) || [])
    : (pendingReferences || []).map((ref) => ({
        document_id: ref.document_id,
        title: ref.title,
        added_at: new Date().toISOString(), // 新建模式使用当前时间作为占位
      }));

  const excludeDocIds = isEditMode
    ? [document.id, ...references.map((ref) => ref.document_id)]
    : references.map((ref) => ref.document_id);

  // 加载分类树
  useEffect(() => {
    if (open) {
      loadCategoryTree();
      setSelectedNodeId(null);
      setAvailableDocs([]);
    }
  }, [open]);

  // 加载选中分类的文档
  useEffect(() => {
    if (selectedNodeId !== null) {
      loadDocuments(selectedNodeId, excludeDocIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  // 当引用列表变化时，重新加载当前分类的文档
  useEffect(() => {
    if (selectedNodeId !== null) {
      loadDocuments(selectedNodeId, excludeDocIds);
    }
  }, [excludeDocIds.length]); // 监听引用列表长度变化

  const loadCategoryTree = async () => {
    try {
      setLoadingTree(true);
      const categories = await getCategoryTree();
      const tree = buildTreeData(categories);
      setTreeData(tree);

      // 默认展开到第3层
      const keysToExpand = collectKeysUpToLevel(tree, 3);
      setExpandedKeys(keysToExpand);

      // 自动选中第一个节点并加载其文档
      if (tree.length > 0) {
        const firstNode = tree[0];
        const key = firstNode.key as string;
        if (key.startsWith("category-")) {
          const nodeId = parseInt(key.replace("category-", ""), 10);
          setSelectedNodeId(nodeId);
          // loadDocuments 会被 useEffect 自动触发
        }
      }
    } catch (error) {
      console.error("Failed to load category tree:", error);
      message.error("加载分类树失败");
    } finally {
      setLoadingTree(false);
    }
  };

  const loadDocuments = async (nodeId: number, currentExcludeIds: number[]) => {
    try {
      setLoadingDocs(true);
      const page = await getNodeDocuments(nodeId, {
        include_descendants: false,
        size: 100,
      });

      console.log('[DEBUG] 加载节点文档:', {
        nodeId,
        totalDocs: page.items.length,
        excludeDocIds: currentExcludeIds,
        docIds: page.items.map(d => d.id),
      });

      // 使用传入的 excludeIds 参数，而不是闭包捕获的值
      const filteredDocs = page.items.filter(
        (doc) => !currentExcludeIds.includes(doc.id)
      );

      console.log('[DEBUG] 过滤后文档:', {
        filteredCount: filteredDocs.length,
        filteredDocIds: filteredDocs.map(d => d.id),
      });

      setAvailableDocs(filteredDocs);
    } catch (error) {
      console.error(`Failed to load documents for node ${nodeId}:`, error);
      message.error("加载文档失败");
      setAvailableDocs([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const buildTreeData = (categories: Category[]): DataNode[] => {
    return categories.map((cat) => {
      const node: DataNode = {
        key: `category-${cat.id}`,
        title: cat.name,
        icon: cat.children && cat.children.length > 0 ? <FolderOutlined /> : <FolderOpenOutlined />,
        children: cat.children && cat.children.length > 0 ? buildTreeData(cat.children) : undefined,
      };
      return node;
    });
  };

  // 收集指定层级内的所有节点key
  const collectKeysUpToLevel = (nodes: DataNode[], maxLevel: number): React.Key[] => {
    const keys: React.Key[] = [];

    const traverse = (nodeList: DataNode[], currentLevel: number) => {
      if (currentLevel > maxLevel) return;

      for (const node of nodeList) {
        keys.push(node.key);
        if (node.children && node.children.length > 0) {
          traverse(node.children, currentLevel + 1);
        }
      }
    };

    traverse(nodes, 1);
    return keys;
  };

  const onExpand = (expandedKeysValue: React.Key[]) => {
    setExpandedKeys(expandedKeysValue);
  };

  const onTreeSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string;
      if (key.startsWith("category-")) {
        const nodeId = parseInt(key.replace("category-", ""), 10);
        setSelectedNodeId(nodeId);
      }
    }
  };

  const handleAddReference = async (selectedDoc: Document) => {
    try {
      setLoading(true);

      // 前端再次检查是否已引用（防御性编程）
      const alreadyReferenced = references.some(ref => ref.document_id === selectedDoc.id);
      if (alreadyReferenced) {
        message.warning(`文档"${selectedDoc.title}" (ID: ${selectedDoc.id}) 已在引用列表中`);
        setLoading(false);
        return;
      }

      console.log('[DEBUG] 添加引用:', {
        sourceDocId: document?.id,
        targetDocId: selectedDoc.id,
        targetTitle: selectedDoc.title,
        currentReferences: references.map(r => ({ id: r.document_id, title: r.title }))
      });

      if (isEditMode) {
        // 编辑模式：调用API添加引用
        const updatedDoc = await addDocumentReference(document.id, {
          document_id: selectedDoc.id,
        });
        message.success(`已添加引用：${selectedDoc.title} (ID: ${selectedDoc.id})`);
        onDocumentUpdated?.(updatedDoc);

        // 立即从可选列表中移除该文档（乐观更新）
        setAvailableDocs(prev => prev.filter(doc => doc.id !== selectedDoc.id));
      } else {
        // 新建模式：添加到待添加列表
        onPendingAdd?.(selectedDoc);
        message.success(`已添加引用：${selectedDoc.title} (ID: ${selectedDoc.id})（文档创建后生效）`);

        // 立即从可选列表中移除该文档（乐观更新）
        setAvailableDocs(prev => prev.filter(doc => doc.id !== selectedDoc.id));
      }
    } catch (error: any) {
      console.error("Failed to add reference:", error);
      const errorMsg = error?.message || "添加引用失败";

      // 如果是重复引用错误，显示更友好的提示
      if (errorMsg.includes("reference already exists") || errorMsg.includes("already exists")) {
        message.error(`无法添加引用：文档"${selectedDoc.title}" (ID: ${selectedDoc.id}) 已在引用列表中`);
      } else {
        message.error(`添加引用失败：${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveReference = async (refDocId: number) => {
    try {
      setLoading(true);

      console.log('[DEBUG] 删除引用:', {
        sourceDocId: document?.id,
        targetDocId: refDocId,
        currentReferences: references.map(r => ({ id: r.document_id, title: r.title })),
        remainingCount: references.length - 1
      });

      if (isEditMode) {
        // 编辑模式：调用API删除引用
        const updatedDoc = await removeDocumentReference(document.id, refDocId);
        console.log('[DEBUG] 删除引用成功，更新后的 references:', updatedDoc.metadata?.references);
        message.success("引用已删除");
        onDocumentUpdated?.(updatedDoc);
        // useEffect 会自动刷新可选文档列表
      } else {
        // 新建模式：从待添加列表中移除
        onPendingRemove?.(refDocId);
        message.success("已移除引用");
        // useEffect 会自动刷新可选文档列表
      }
    } catch (error: any) {
      console.error("Failed to remove reference:", error);
      const errorMsg = error?.message || "删除引用失败";
      message.error(`删除引用失败：${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentClick = (docId: number) => {
    // 在新标签页打开文档
    window.open(`/documents/${docId}`, "_blank");
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    // TODO: 实现搜索过滤逻辑
  };

  return (
    <Modal
      title={
        <Space>
          <LinkOutlined />
          <span>管理文档引用</span>
          {!isEditMode && <Tag color="blue">新建模式</Tag>}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={1200}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>,
      ]}
      styles={{ body: { padding: "16px 0", height: "70vh" } }}
    >
      <div style={{ display: "flex", height: "100%", gap: 16, padding: "0 24px" }}>
        {/* 左侧：分类树 */}
        <div style={{
          width: 240,
          borderRight: "1px solid #f0f0f0",
          paddingRight: 16,
          display: "flex",
          flexDirection: "column",
        }}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            分类目录
          </Typography.Title>
          <div style={{ flex: 1, overflow: "auto" }}>
            <Spin spinning={loadingTree}>
              {treeData.length > 0 ? (
                <Tree
                  showIcon
                  showLine
                  expandedKeys={expandedKeys}
                  selectedKeys={selectedNodeId !== null ? [`category-${selectedNodeId}`] : []}
                  onExpand={onExpand}
                  onSelect={onTreeSelect}
                  treeData={treeData}
                />
              ) : (
                <Empty description="暂无分类" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Spin>
          </div>
        </div>

        {/* 中间：可选文档列表 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #f0f0f0", paddingRight: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
              选择文档
            </Typography.Title>
            <Search
              placeholder="搜索文档"
              onSearch={handleSearch}
              allowClear
              size="small"
            />
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            {selectedNodeId === null ? (
              <Empty
                description="请先选择左侧分类"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ marginTop: 60 }}
              />
            ) : loadingDocs ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
                <Spin />
              </div>
            ) : availableDocs.length === 0 ? (
              <Empty
                description="该分类下无可选文档"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ marginTop: 60 }}
              />
            ) : (
              <List
                size="small"
                dataSource={availableDocs}
                renderItem={(doc) => (
                  <List.Item
                    style={{
                      cursor: "pointer",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      marginBottom: "4px",
                    }}
                    onClick={() => handleAddReference(doc)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f5f5f5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined style={{ fontSize: 14, color: "#1890ff" }} />}
                      title={<Text style={{ fontSize: "14px" }}>{doc.title}</Text>}
                      description={
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          ID: {doc.id}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </div>

        {/* 右侧：已引用的文档列表 */}
        <div style={{ width: 320, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 0 }}>
              已引用文档
            </Typography.Title>
            <Tag color={references.length > 0 ? "blue" : "default"}>
              {references.length}
            </Tag>
          </div>

          {!isEditMode && references.length > 0 && (
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
              （文档创建后生效）
            </Text>
          )}

          <div style={{ flex: 1, overflow: "auto" }}>
            <Spin spinning={loading}>
              {references.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无引用"
                  style={{ marginTop: 60 }}
                />
              ) : (
                <List
                  size="small"
                  dataSource={references}
                  renderItem={(ref) => (
                    <List.Item
                      style={{ padding: "8px 0" }}
                      actions={[
                        <Popconfirm
                          key="delete"
                          title="确认删除？"
                          description="仅删除引用关系"
                          onConfirm={() => handleRemoveReference(ref.document_id)}
                          okText="确认"
                          cancelText="取消"
                          disabled={loading}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            loading={loading}
                            disabled={loading}
                          />
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<FileTextOutlined style={{ fontSize: 14, color: "#52c41a" }} />}
                        title={
                          <Link
                            onClick={() => handleDocumentClick(ref.document_id)}
                            style={{ cursor: "pointer", fontSize: "14px" }}
                          >
                            {ref.title}
                          </Link>
                        }
                        description={
                          <div style={{ fontSize: 12 }}>
                            <Text type="secondary">ID: {ref.document_id}</Text>
                            {isEditMode ? (
                              <Text type="secondary" style={{ marginLeft: 8 }}>
                                | {new Date(ref.added_at).toLocaleDateString()}
                              </Text>
                            ) : (
                              <Tag style={{ marginLeft: 8, fontSize: 12 }}>待添加</Tag>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Spin>
          </div>
        </div>
      </div>
    </Modal>
  );
}
