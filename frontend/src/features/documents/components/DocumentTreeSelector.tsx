import { FileTextOutlined, FolderOpenOutlined, FolderOutlined } from "@ant-design/icons";
import { Input, List, message, Modal, Spin, Tree, Typography, Empty } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useState } from "react";
import { getCategoryTree, type Category } from "../../../api/categories";
import { getNodeDocuments, type Document } from "../../../api/documents";

const { Search } = Input;
const { Text } = Typography;

interface DocumentTreeSelectorProps {
  open: boolean;
  onCancel: () => void;
  onSelect: (document: Document) => void;
  excludeDocIds?: number[]; // 要排除的文档 ID（如当前编辑的文档和已引用的文档）
  title?: string;
}

export function DocumentTreeSelector({
  open,
  onCancel,
  onSelect,
  excludeDocIds = [],
  title = "选择文档",
}: DocumentTreeSelectorProps) {
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (open) {
      loadCategoryTree();
      setSelectedNodeId(null);
      setDocuments([]);
    }
  }, [open]);

  useEffect(() => {
    if (selectedNodeId !== null) {
      loadDocuments(selectedNodeId);
    }
  }, [selectedNodeId]);

  const loadCategoryTree = async () => {
    try {
      setLoadingTree(true);
      const categories = await getCategoryTree();
      const tree = buildTreeData(categories);
      setTreeData(tree);

      // 默认展开到第3层
      const keysToExpand = collectKeysUpToLevel(tree, 3);
      setExpandedKeys(keysToExpand);
    } catch (error) {
      console.error("Failed to load category tree:", error);
      message.error("加载分类树失败");
    } finally {
      setLoadingTree(false);
    }
  };

  const loadDocuments = async (nodeId: number) => {
    try {
      setLoadingDocs(true);
      const page = await getNodeDocuments(nodeId, {
        include_descendants: false,
        size: 100,
      });

      // 过滤排除的文档
      const filteredDocs = page.items.filter(
        (doc) => !excludeDocIds.includes(doc.id)
      );

      setDocuments(filteredDocs);
    } catch (error) {
      console.error(`Failed to load documents for node ${nodeId}:`, error);
      message.error("加载文档失败");
      setDocuments([]);
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

  const handleDocumentClick = (doc: Document) => {
    onSelect(doc);
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    // TODO: 实现搜索过滤逻辑
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={900}
      styles={{ body: { padding: "16px 0", height: "70vh" } }}
    >
      <div style={{ display: "flex", height: "100%", gap: 16, padding: "0 24px" }}>
        {/* 左侧分类树 */}
        <div style={{
          width: 280,
          borderRight: "1px solid #f0f0f0",
          paddingRight: 16,
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ marginBottom: 12, color: "#666", fontSize: "12px" }}>
            点击分类查看文档
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            <Spin spinning={loadingTree}>
              {treeData.length > 0 ? (
                <Tree
                  showIcon
                  showLine
                  expandedKeys={expandedKeys}
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

        {/* 右侧文档列表 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Search
            style={{ marginBottom: 16 }}
            placeholder="搜索文档"
            onSearch={handleSearch}
            allowClear
          />

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
            ) : documents.length === 0 ? (
              <Empty
                description="该分类下暂无文档"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ marginTop: 60 }}
              />
            ) : (
              <List
                dataSource={documents}
                renderItem={(doc) => (
                  <List.Item
                    style={{ cursor: "pointer", padding: "12px 16px" }}
                    onClick={() => handleDocumentClick(doc)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f5f5f5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined style={{ fontSize: 16, color: "#1890ff" }} />}
                      title={<Text>{doc.title}</Text>}
                      description={
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          ID: {doc.id} | 类型: {doc.type}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
                bordered
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
