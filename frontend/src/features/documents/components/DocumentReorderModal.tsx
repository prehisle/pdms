import type { FC } from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Modal, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { HolderOutlined } from "@ant-design/icons";
import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  useEffect(() => {
    if (open && documents.length > 0) {
      // Sort documents by position when modal opens
      const sorted = [...documents].sort((a, b) => a.position - b.position);
      setOrderedDocs(sorted);
    } else if (!open) {
      setOrderedDocs([]);
    }
  }, [open, documents]);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }

    const activeId = Number(active.id);
    const overId = Number(over.id);

    setOrderedDocs((prev) => {
      const oldIndex = prev.findIndex((doc) => doc.id === activeId);
      const newIndex = prev.findIndex((doc) => doc.id === overId);

      if (oldIndex === -1 || newIndex === -1) {
        return prev;
      }

      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

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
  ];

  interface SortableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    "data-row-key"?: string | number;
  }

  const SortableRow: FC<SortableRowProps> = ({ children, ...props }) => {
    const rawRowKey = props["data-row-key"];

    if (rawRowKey == null) {
      return <tr {...props}>{children}</tr>;
    }

    const rowId = Number(rawRowKey);
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: rowId, transition: { duration: 150, easing: "ease" } });

    const style = {
      ...props.style,
      cursor: "grab",
      transition,
      transform: transform ? CSS.Transform.toString(transform) : undefined,
      ...(isDragging
        ? {
            position: "relative" as const,
            zIndex: 1000,
            boxShadow: "0 6px 12px rgba(0,0,0,0.12)",
            opacity: 0.8,
          }
        : {}),
    };

    return (
      <tr
        {...props}
        {...attributes}
        {...listeners}
        ref={setNodeRef}
        style={style}
      >
        {children}
      </tr>
    );
  };

  const tableComponents = useMemo(
    () => ({
      body: {
        row: SortableRow,
      },
    }),
    [],
  );

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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext
          items={orderedDocs.map((doc) => doc.id)}
          strategy={verticalListSortingStrategy}
        >
          <Table
            rowKey="id"
            dataSource={orderedDocs}
            columns={columns}
            pagination={false}
            size="small"
            bordered
            components={tableComponents}
          />
        </SortableContext>
      </DndContext>
    </Modal>
  );
};
