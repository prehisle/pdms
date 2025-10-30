import { FileTextOutlined, FolderOpenOutlined, FolderOutlined } from "@ant-design/icons";
import { Input, message, Modal, Spin, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useState } from "react";
import { getCategoryTree, type Category } from "../../../api/categories";
import { getNodeDocuments, type Document } from "../../../api/documents";

const { Search } = Input;

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
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [loadedNodeDocs, setLoadedNodeDocs] = useState<Map<number, Document[]>>(
    new Map()
  );

  useEffect(() => {
    if (open) {
      loadCategoryTree();
    }
  }, [open]);

  const loadCategoryTree = async () => {
    try {
      setLoading(true);
      const categories = await getCategoryTree();
      const tree = buildTreeData(categories);
      setTreeData(tree);
    } catch (error) {
      console.error("Failed to load category tree:", error);
      message.error("加载分类树失败");
    } finally {
      setLoading(false);
    }
  };

  const buildTreeData = (categories: Category[]): DataNode[] => {
    return categories.map((cat) => {
      const children: DataNode[] = [];

      // 添加子分类
      if (cat.children && cat.children.length > 0) {
        children.push(...buildTreeData(cat.children));
      }

      // 添加占位符，实际文档会在展开时加载
      const node: DataNode = {
        key: `category-${cat.id}`,
        title: cat.name,
        icon: cat.children && cat.children.length > 0 ? <FolderOutlined /> : <FolderOpenOutlined />,
        children: children.length > 0 ? children : undefined,
        isLeaf: false,
      };

      return node;
    });
  };

  const loadDocumentsForNode = async (nodeId: number): Promise<DataNode[]> => {
    try {
      const page = await getNodeDocuments(nodeId, {
        include_descendants: false,
        size: 1000, // 获取足够多的文档
      });

      // 过滤排除的文档
      const filteredDocs = page.items.filter(
        (doc) => !excludeDocIds.includes(doc.id)
      );

      setLoadedNodeDocs((prev) => new Map(prev).set(nodeId, filteredDocs));

      return filteredDocs.map((doc) => ({
        key: `doc-${doc.id}`,
        title: doc.title,
        icon: <FileTextOutlined />,
        isLeaf: true,
        data: doc,
      }));
    } catch (error) {
      console.error(`Failed to load documents for node ${nodeId}:`, error);
      return [];
    }
  };

  const onLoadData = async (treeNode: DataNode): Promise<void> => {
    const key = treeNode.key as string;

    // 只加载分类节点的文档
    if (key.startsWith("category-")) {
      const nodeId = parseInt(key.replace("category-", ""), 10);

      // 如果已经加载过，直接返回
      if (loadedNodeDocs.has(nodeId)) {
        return;
      }

      const docNodes = await loadDocumentsForNode(nodeId);

      // 更新树数据，在当前节点下添加文档节点
      setTreeData((prevTree) => updateTreeWithDocs(prevTree, key, docNodes));
    }
  };

  const updateTreeWithDocs = (
    tree: DataNode[],
    targetKey: string,
    docNodes: DataNode[]
  ): DataNode[] => {
    return tree.map((node) => {
      if (node.key === targetKey) {
        return {
          ...node,
          children: [
            ...(node.children || []).filter((child) =>
              (child.key as string).startsWith("category-")
            ),
            ...docNodes,
          ],
        };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeWithDocs(node.children, targetKey, docNodes),
        };
      }
      return node;
    });
  };

  const onExpand = (expandedKeysValue: React.Key[]) => {
    setExpandedKeys(expandedKeysValue);
  };

  const onTreeSelect = (_selectedKeys: React.Key[], info: any) => {
    const key = info.node.key as string;

    // 只处理文档节点的选择
    if (key.startsWith("doc-")) {
      const document = info.node.data as Document;
      onSelect(document);
    }
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    // TODO: 实现搜索过滤逻辑
    // 这里可以根据搜索值过滤树节点
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
      styles={{ body: { maxHeight: "60vh", overflow: "auto" } }}
    >
      <Search
        style={{ marginBottom: 16 }}
        placeholder="搜索文档或分类"
        onSearch={handleSearch}
        allowClear
      />

      <Spin spinning={loading}>
        {treeData.length > 0 ? (
          <Tree
            showIcon
            loadData={onLoadData}
            expandedKeys={expandedKeys}
            onExpand={onExpand}
            onSelect={onTreeSelect}
            treeData={treeData}
            style={{ minHeight: 300 }}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
            暂无数据
          </div>
        )}
      </Spin>
    </Modal>
  );
}
