import { useCallback, useMemo, type ReactNode } from "react";

import { Breadcrumb, Dropdown, Typography } from "antd";
import type { MenuProps } from "antd";
import { DownOutlined, FolderOutlined, HomeOutlined } from "@ant-design/icons";

import type { Category } from "../../../api/categories";
import type { CategoryLookups, ParentKey } from "../types";

export interface CategoryBreadcrumbProps {
  selectedNodeId: number | null;
  lookups: CategoryLookups;
  onNavigate: (nodeId: number) => void;
}

export function CategoryBreadcrumb({ selectedNodeId, lookups, onNavigate }: CategoryBreadcrumbProps) {
  const breadcrumbPath = useMemo(() => {
    if (selectedNodeId == null) {
      return [];
    }

    const path: Category[] = [];
    let currentId: number | null = selectedNodeId;

    while (currentId != null) {
      const node = lookups.byId.get(currentId);
      if (!node) {
        break;
      }
      path.unshift(node);
      currentId = node.parent_id;
    }

    return path;
  }, [selectedNodeId, lookups]);

  const buildMenuForParent = useCallback(
    (parentId: ParentKey, options?: { selectedId?: number }): MenuProps | undefined => {
      const children = lookups.parentToChildren.get(parentId ?? null) ?? [];
      if (children.length === 0) {
        return undefined;
      }

      const selectedId = options?.selectedId ?? null;
      return {
        selectable: selectedId != null,
        selectedKeys: selectedId != null ? [selectedId.toString()] : [],
        onClick: ({ key }) => {
          const targetId = Number(key);
          if (!Number.isNaN(targetId)) {
            onNavigate(targetId);
          }
        },
        items: children.map((node) => ({
          key: node.id.toString(),
          label: (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontWeight: node.id === selectedId ? 600 : undefined,
                color: node.id === selectedId ? "#1677ff" : undefined,
              }}
            >
              <FolderOutlined />
              {node.name}
            </span>
          ),
        })),
      };
    },
    [lookups.parentToChildren, onNavigate],
  );

  const rootNode = breadcrumbPath[0] ?? null;
  const rootMenu = useMemo(
    () => (rootNode ? buildMenuForParent(null, { selectedId: rootNode.id }) : undefined),
    [buildMenuForParent, rootNode],
  );

  if (selectedNodeId == null || breadcrumbPath.length === 0) {
    return (
      <div
        style={{
          padding: "12px 16px",
          background: "#fafafa",
          borderRadius: 4,
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

  const makeDropdownTrigger = (menu: MenuProps | undefined, children: ReactNode) => {
    if (!menu) {
      return children;
    }
    return (
      <Dropdown menu={menu} trigger={["click"]}>
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {children}
        </span>
      </Dropdown>
    );
  };

  const items = [
    {
      title: (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <a
            onClick={(event) => {
              event.preventDefault();
              if (rootNode) {
                onNavigate(rootNode.id);
              }
            }}
            style={{ color: "#595959" }}
          >
            <HomeOutlined />
          </a>
          {rootMenu
            ? makeDropdownTrigger(
                rootMenu,
                <DownOutlined style={{ fontSize: 10, color: "#bfbfbf" }} />,
              )
            : null}
        </span>
      ),
    },
    ...breadcrumbPath.map((node, index) => {
      const isLast = index === breadcrumbPath.length - 1;
      const menu = isLast
        ? buildMenuForParent(node.id)
        : buildMenuForParent(node.parent_id ?? null, { selectedId: node.id });

      const label = isLast ? (
        <span style={{ fontWeight: 600, color: "#1890ff", display: "inline-flex", gap: 4 }}>
          <FolderOutlined />
          {node.name}
        </span>
      ) : (
        <a
          onClick={(event) => {
            event.preventDefault();
            onNavigate(node.id);
          }}
          style={{ color: "#595959", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          <FolderOutlined />
          {node.name}
        </a>
      );

      return {
        title: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {label}
            {menu
              ? makeDropdownTrigger(
                  menu,
                  <DownOutlined style={{ fontSize: 10, color: "#bfbfbf" }} />,
                )
              : null}
          </span>
        ),
      };
    }),
  ];

  return (
    <div
      style={{
        padding: "12px 16px",
        background: "#fafafa",
        borderRadius: 4,
        border: "1px solid #f0f0f0",
      }}
    >
      <Breadcrumb items={items} separator=">" />
    </div>
  );
}
