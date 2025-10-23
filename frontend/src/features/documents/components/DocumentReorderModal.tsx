import type { FC } from "react";
import { useState, useEffect } from "react";
import {
  Modal,
  Table,
  Button,
  Space,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { UpOutlined, DownOutlined } from "@ant-design/icons";

import type { Document } from "../../../api/documents";

interface DocumentReorderModalProps {
  open: boolean;
  documents: Document[];
  loading: boolean;
  onCancel: () => void;
  onConfirm: (orderedIds: number[]) => void;
}

export const DocumentReorderModal: FC<DocumentReorderModalProps> = ({
  open,
  documents,
  loading,
  onCancel,
  onConfirm,
}) => {
  const [orderedDocs, setOrderedDocs] = useState<Document[]>([]);

  useEffect(() => {
    if (open && documents.length > 0) {
      // Sort documents by position when modal opens
      const sorted = [...documents].sort((a, b) => a.position - b.position);
      setOrderedDocs(sorted);
    }
  }, [open, documents]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...orderedDocs];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setOrderedDocs(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === orderedDocs.length - 1) return;
    const newOrder = [...orderedDocs];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setOrderedDocs(newOrder);
  };

  const handleConfirm = () => {
    const orderedIds = orderedDocs.map(doc => doc.id);
    onConfirm(orderedIds);
  };

  const columns: ColumnsType<Document> = [
    {
      title: "当前位置",
      key: "currentPosition",
      width: 80,
      render: (_, __, index) => (
        <Typography.Text strong>{index + 1}</Typography.Text>
      ),
    },
    {
      title: "文档名称",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "文档类型",
      dataIndex: "type",
      key: "type",
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "原位置",
      dataIndex: "position",
      key: "position",
      width: 80,
    },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, __, index) => (
        <Space>
          <Button
            type="text"
            icon={<UpOutlined />}
            size="small"
            disabled={index === 0}
            onClick={() => moveUp(index)}
            title="上移"
          />
          <Button
            type="text"
            icon={<DownOutlined />}
            size="small"
            disabled={index === orderedDocs.length - 1}
            onClick={() => moveDown(index)}
            title="下移"
          />
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title="调整文档排序"
      open={open}
      width={800}
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText="确认调整"
      cancelText="取消"
    >
      <Typography.Paragraph type="secondary">
        通过上移、下移按钮调整文档顺序，确认后将更新文档的排序位置。
      </Typography.Paragraph>

      <Table
        rowKey="id"
        dataSource={orderedDocs}
        columns={columns}
        pagination={false}
        size="small"
        bordered
      />
    </Modal>
  );
};