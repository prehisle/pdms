import type { FC } from "react";

import {
  Alert,
  Button,
  Empty,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Key } from "react";
import {
  CloseCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from "@ant-design/icons";

import type { Category } from "../../../api/categories";

interface CategoryTrashModalProps {
  open: boolean;
  loading: boolean;
  isInitialLoading: boolean;
  error: unknown;
  trashItems: Category[];
  columns: ColumnsType<Category>;
  selectedRowKeys: Key[];
  onSelectedRowKeysChange: (keys: Key[]) => void;
  onRefresh: () => void;
  onClose: () => void;
  onBulkRestore: () => void;
  onBulkPurge: () => void;
  isMutating: boolean;
  onClearSelection: () => void;
}

export const CategoryTrashModal: FC<CategoryTrashModalProps> = ({
  open,
  loading,
  isInitialLoading,
  trashItems,
  columns,
  error,
  selectedRowKeys,
  onSelectedRowKeysChange,
  onRefresh,
  onClose,
  onBulkRestore,
  onBulkPurge,
  isMutating,
  onClearSelection,
}) => (
  <Modal
    title="回收站"
    open={open}
    footer={null}
    width={720}
    onCancel={onClose}
  >
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 16,
      }}
    >
      <Tooltip title="刷新回收站">
        <Button
          icon={<ReloadOutlined />}
          type="text"
          shape="circle"
          onClick={onRefresh}
          loading={loading}
          aria-label="刷新回收站"
        />
      </Tooltip>
      <Tooltip title="批量恢复">
        <span style={{ display: "inline-flex" }}>
          <Button
            icon={<RollbackOutlined />}
            type="primary"
            shape="circle"
            onClick={onBulkRestore}
            disabled={selectedRowKeys.length === 0 || isMutating}
            loading={isMutating}
            aria-label="批量恢复"
          />
        </span>
      </Tooltip>
      <Popconfirm
        title={`确认彻底删除选中的 ${selectedRowKeys.length} 个目录？`}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: selectedRowKeys.length === 0 }}
        onConfirm={onBulkPurge}
        disabled={selectedRowKeys.length === 0 || isMutating}
      >
        <Tooltip title="批量彻底删除">
          <span style={{ display: "inline-flex" }}>
            <Button
              icon={<DeleteOutlined />}
              danger
              type="text"
              shape="circle"
              disabled={selectedRowKeys.length === 0 || isMutating}
              loading={isMutating}
              aria-label="批量彻底删除"
            />
          </span>
        </Tooltip>
      </Popconfirm>
      <Tooltip title="清空选择">
        <span style={{ display: "inline-flex" }}>
          <Button
            icon={<CloseCircleOutlined />}
            type="text"
            shape="circle"
            onClick={onClearSelection}
            disabled={selectedRowKeys.length === 0}
            aria-label="清空选择"
          />
        </span>
      </Tooltip>
    </div>
    {isInitialLoading ? (
      <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
        <Spin />
      </div>
    ) : error ? (
      <Alert
        type="error"
        message="回收站加载失败"
        description={(error as Error).message}
      />
    ) : trashItems.length === 0 ? (
      <Empty description="暂无已删除目录" />
    ) : (
      <Table
        rowKey="id"
        pagination={false}
        dataSource={trashItems}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: onSelectedRowKeysChange,
        }}
      />
    )}
  </Modal>
);
