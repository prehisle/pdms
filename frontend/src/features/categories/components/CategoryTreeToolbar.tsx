import type { FC } from "react";

import { Input, Tooltip, Button, Switch } from "antd";

import {
  FolderAddOutlined,
  DeleteFilled,
  ReloadOutlined,
} from "@ant-design/icons";

interface CategoryTreeToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  onRefresh: () => void;
  onCreateRoot: () => void;
  onOpenTrash: () => void;
  includeDescendants: boolean;
  onIncludeDescendantsChange: (value: boolean) => void;
  isRefreshing: boolean;
  createLoading: boolean;
  trashIsFetching: boolean;
  selectedNodeId: number | null;
}

export const CategoryTreeToolbar: FC<CategoryTreeToolbarProps> = ({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onRefresh,
  onCreateRoot,
  onOpenTrash,
  includeDescendants,
  onIncludeDescendantsChange,
  isRefreshing,
  createLoading,
  trashIsFetching,
  selectedNodeId,
}) => (
  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    }}
  >
    <Input.Search
      placeholder="搜索目录"
      allowClear
      value={searchValue}
      onChange={(e) => onSearchChange(e.target.value)}
      onSearch={onSearchSubmit}
      style={{ width: 200 }}
    />
    <Tooltip title="刷新目录">
      <Button
        icon={<ReloadOutlined />}
        type="text"
        shape="circle"
        onClick={onRefresh}
        loading={isRefreshing}
        aria-label="刷新目录"
      />
    </Tooltip>
    <Tooltip title="新建根目录">
      <span style={{ display: "inline-flex" }}>
        <Button
          icon={<FolderAddOutlined />}
          type="primary"
          shape="circle"
          onClick={onCreateRoot}
          loading={createLoading}
          disabled={createLoading}
          aria-label="新建根目录"
        />
      </span>
    </Tooltip>
    <Tooltip title="打开回收站">
      <span style={{ display: "inline-flex" }}>
        <Button
          icon={<DeleteFilled />}
          type="text"
          shape="circle"
          onClick={onOpenTrash}
          loading={trashIsFetching}
          aria-label="打开回收站"
        />
      </span>
    </Tooltip>
    <Tooltip
      title={
        includeDescendants ? "显示当前节点及子节点的文档" : "仅显示当前节点文档"
      }
    >
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <Switch
          size="small"
          checked={includeDescendants}
          onChange={onIncludeDescendantsChange}
          checkedChildren="含子"
          unCheckedChildren="当前"
          aria-label="切换文档范围"
          disabled={selectedNodeId == null}
          style={{ marginLeft: 4 }}
        />
      </span>
    </Tooltip>
  </div>
);
