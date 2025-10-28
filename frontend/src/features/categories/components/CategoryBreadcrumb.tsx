import { useMemo } from "react";
import { Breadcrumb, Typography } from "antd";
import { HomeOutlined, FolderOutlined } from "@ant-design/icons";
import type { Category } from "../../../api/categories";
import type { CategoryLookups } from "../types";

export interface CategoryBreadcrumbProps {
  selectedNodeId: number | null;
  lookups: CategoryLookups;
  onNavigate: (nodeId: number) => void;
}

export function CategoryBreadcrumb({ selectedNodeId, lookups, onNavigate }: CategoryBreadcrumbProps) {
  // 构建从根节点到当前节点的路径
  const breadcrumbPath = useMemo(() => {
    if (selectedNodeId == null) {
      return [];
    }

    const path: Category[] = [];
    let currentId: number | null = selectedNodeId;

    // 从当前节点向上遍历到根节点
    while (currentId != null) {
      const node = lookups.byId.get(currentId);
      if (!node) break;
      path.unshift(node); // 添加到数组开头
      currentId = node.parent_id;
    }

    return path;
  }, [selectedNodeId, lookups]);

  // 如果没有选中节点，显示提示信息
  if (selectedNodeId == null || breadcrumbPath.length === 0) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "#fafafa",
          borderRadius: "4px",
          border: "1px solid #f0f0f0",
        }}
      >
        <Typography.Text type="secondary">
          <HomeOutlined style={{ marginRight: 8 }} />
          请从左侧选择一个目录节点查看文档
        </Typography.Text>
      </div>
    );
  }

  // 构建面包屑项
  const items = [
    // 首页图标（虚拟根节点）
    {
      title: (
        <span style={{ cursor: "default" }}>
          <HomeOutlined />
        </span>
      ),
    },
    // 路径中的每个节点
    ...breadcrumbPath.map((node, index) => {
      const isLast = index === breadcrumbPath.length - 1;
      return {
        title: isLast ? (
          // 最后一个节点（当前位置）不可点击，高亮显示
          <span style={{ fontWeight: 600, color: "#1890ff" }}>
            <FolderOutlined style={{ marginRight: 4 }} />
            {node.name}
          </span>
        ) : (
          // 父级节点可点击
          <a
            onClick={(e) => {
              e.preventDefault();
              onNavigate(node.id);
            }}
            style={{ color: "#595959" }}
          >
            <FolderOutlined style={{ marginRight: 4 }} />
            {node.name}
          </a>
        ),
      };
    }),
  ];

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "#fafafa",
        borderRadius: "4px",
        border: "1px solid #f0f0f0",
      }}
    >
      <Breadcrumb items={items} separator=">" />
    </div>
  );
}
