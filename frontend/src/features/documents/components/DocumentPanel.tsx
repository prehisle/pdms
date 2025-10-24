import type { FC } from "react";

import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FormInstance } from "antd/es/form";
import { PlusOutlined, SearchOutlined, FileTextOutlined, SortAscendingOutlined } from "@ant-design/icons";

import type { Document } from "../../../api/documents";
import type { DocumentFilterFormValues } from "../types";

interface DocumentPanelProps {
  filterForm: FormInstance<DocumentFilterFormValues>;
  documentTypes: { label: string; value: string }[];
  selectedNodeId: number | null;
  documents: Document[];
  columns: ColumnsType<Document>;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onSearch: (values: DocumentFilterFormValues) => void;
  onReset: () => void;
  onAddDocument: () => void;
  onReorderDocuments: () => void;
  onOpenTrash: () => void;
}

export const DocumentPanel: FC<DocumentPanelProps> = ({
  filterForm,
  documentTypes,
  selectedNodeId,
  documents,
  columns,
  isLoading,
  isFetching,
  error,
  onSearch,
  onReset,
  onAddDocument,
  onReorderDocuments,
  onOpenTrash,
}) => (
  <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <Card>
      <Form
        layout="inline"
        form={filterForm}
        onFinish={onSearch}
        style={{ gap: 16, flexWrap: "wrap" }}
      >
        <Form.Item name="docId" label="文档 ID">
          <Input
            placeholder="例如 123"
            allowClear
            style={{ width: 160 }}
            onKeyPress={(e) => {
              // Allow only numbers, backspace, delete, and navigation keys
              if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                e.preventDefault();
              }
            }}
          />
        </Form.Item>
        <Form.Item name="query" label="关键字">
          <Input placeholder="标题 / 内容" allowClear style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="type" label="文档类型">
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="选择类型"
            options={documentTypes}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              筛选
            </Button>
            <Button onClick={onReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
    <Card
      title={
        <Space>
          <FileTextOutlined />
          <span>文档列表</span>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="文档回收站">
            <Button onClick={onOpenTrash}>
              回收站
            </Button>
          </Tooltip>
          <Tooltip title="调整排序">
            <Button
              icon={<SortAscendingOutlined />}
              onClick={onReorderDocuments}
              disabled={selectedNodeId == null || documents.length <= 1}
              aria-label="调整文档排序"
            />
          </Tooltip>
          <Tooltip title="新增文档">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onAddDocument}
              disabled={selectedNodeId == null}
              aria-label="新增文档"
            />
          </Tooltip>
        </Space>
      }
    >
      {selectedNodeId == null ? (
        <Typography.Paragraph type="secondary">
          请选择单个目录节点以查看文档。
        </Typography.Paragraph>
      ) : isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
          <Spin />
        </div>
      ) : error ? (
        <Alert
          type="error"
          message="文档加载失败"
          description={(error as Error).message}
        />
      ) : documents.length === 0 ? (
        <Empty description="暂无文档" />
      ) : (
        <Table
          rowKey="id"
          dataSource={documents}
          columns={columns}
          pagination={false}
          loading={isFetching}
        />
      )}
    </Card>
  </Space>
);
