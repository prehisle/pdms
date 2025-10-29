import type { FC, DragEvent } from "react";
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
import { UpOutlined, DownOutlined, HolderOutlined } from "@ant-design/icons";

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
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

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

  const handleDragStart = (e: DragEvent<HTMLTableRowElement>, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLTableRowElement>, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDropIndex(index);
  };

  const handleDragLeave = () => {
    setDropIndex(null);
  };

  const handleDrop = (e: DragEvent<HTMLTableRowElement>, dropIdx: number) => {
    e.preventDefault();

    if (dragIndex === null || dragIndex === dropIdx) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }

    const newOrder = [...orderedDocs];
    const draggedItem = newOrder[dragIndex];

    // Remove dragged item
    newOrder.splice(dragIndex, 1);
    // Insert at drop position
    newOrder.splice(dropIdx, 0, draggedItem);

    setOrderedDocs(newOrder);
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleConfirm = () => {
    const orderedIds = orderedDocs.map(doc => doc.id);
    onConfirm(orderedIds);
  };

  const columns: ColumnsType<Document> = [
    {
      title: "",
      key: "drag",
      width: 40,
      render: () => (
        <HolderOutlined style={{ cursor: "move", color: "#999" }} />
      ),
    },
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
        通过拖拽行、或使用上移/下移按钮来调整文档顺序，确认后将更新文档的排序位置。
      </Typography.Paragraph>

      <Table
        rowKey="id"
        dataSource={orderedDocs}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        components={{
          body: {
            row: (props: any) => {
              const index = orderedDocs.findIndex(
                (doc) => doc.id === Number(props["data-row-key"])
              );

              const isDragging = dragIndex === index;
              const isDropTarget = dropIndex === index;

              return (
                <tr
                  {...props}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    ...props.style,
                    cursor: "move",
                    opacity: isDragging ? 0.5 : 1,
                    backgroundColor: isDropTarget ? "#e6f7ff" : undefined,
                    borderTop: isDropTarget ? "2px solid #1890ff" : undefined,
                  }}
                />
              );
            },
          },
        }}
      />
    </Modal>
  );
};