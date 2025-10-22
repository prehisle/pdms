import type { FC } from "react";

import { Input, Tooltip, Button, Popconfirm, Switch } from "antd";

import {
  FolderAddOutlined,
  PlusSquareOutlined,
  EditOutlined,
  DeleteOutlined,
  DeleteFilled,
  ReloadOutlined,
} from "@ant-design/icons";

interface CategoryTreeToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  onRefresh: () => void;
  onCreateRoot: () => void;
  onCreateChild: () => void;
  onRename: () => void;
  onDelete: () => void;
  onOpenTrash: () => void;
  includeDescendants: boolean;
  onIncludeDescendantsChange: (value: boolean) => void;
  canCreateChild: boolean;
  canRename: boolean;
  canDelete: boolean;
  isRefreshing: boolean;
  createLoading: boolean;
  updateLoading: boolean;
  deleteLoading: boolean;
  trashIsFetching: boolean;
  selectedNodeId: number | null;
}

export const CategoryTreeToolbar: FC<CategoryTreeToolbarProps> = ({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onRefresh,
  onCreateRoot,
  onCreateChild,
  onRename,
  onDelete,
  onOpenTrash,
  includeDescendants,
  onIncludeDescendantsChange,
  canCreateChild,
  canRename,
  canDelete,
  isRefreshing,
  createLoading,
  updateLoading,
  deleteLoading,
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
    <Tooltip title="新建子目录">
      <span style={{ display: "inline-flex" }}>
        <Button
          icon={<PlusSquareOutlined />}
          type="primary"
          shape="circle"
          onClick={onCreateChild}
          loading={createLoading}
          disabled={!canCreateChild || createLoading}
          aria-label="新建子目录"
        />
      </span>
    </Tooltip>
    <Tooltip title="重命名目录">
      <span style={{ display: "inline-flex" }}>
        <Button
          icon={<EditOutlined />}
          type="text"
          shape="circle"
          onClick={onRename}
          loading={updateLoading}
          disabled={!canRename || updateLoading}
          aria-label="重命名目录"
        />
      </span>
    </Tooltip>
    <Popconfirm
      title="确认删除该目录？"
      okText="删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onConfirm={onDelete}
      disabled={!canDelete}
    >
      <Tooltip title="删除目录">
        <span style={{ display: "inline-flex" }}>
          <Button
            icon={<DeleteOutlined />}
            danger
            type="text"
            shape="circle"
            disabled={!canDelete || deleteLoading}
            loading={deleteLoading}
            aria-label="删除目录"
          />
        </span>
      </Tooltip>
    </Popconfirm>
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
