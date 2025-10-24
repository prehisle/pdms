import { type FC, useEffect } from "react";

import {
  Alert,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { UndoOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";

import type { Document, DocumentTrashPage } from "../../../api/documents";

interface DocumentTrashDrawerProps {
  open: boolean;
  loading: boolean;
  data?: DocumentTrashPage;
  onClose: () => void;
  onRefresh: () => void;
  onSearch: (query?: string) => void;
  onPageChange: (page: number, pageSize?: number) => void;
  onRestore: (doc: Document) => void;
  onPurge: (doc: Document) => void;
  restoreLoadingId?: number | null;
  purgeLoadingId?: number | null;
  error?: unknown;
  queryValue?: string;
}

export const DocumentTrashDrawer: FC<DocumentTrashDrawerProps> = ({
  open,
  loading,
  data,
  onClose,
  onRefresh,
  onSearch,
  onPageChange,
  onRestore,
  onPurge,
  restoreLoadingId,
  purgeLoadingId,
  error,
  queryValue,
}) => {
  const [form] = Form.useForm<{ query?: string }>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ query: queryValue });
    }
  }, [form, open, queryValue]);

  const handleSearch = () => {
    const values = form.getFieldsValue();
    onSearch(values.query?.trim() || undefined);
  };

  const columns: ColumnsType<Document> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 80,
    },
    {
      title: "名称",
      dataIndex: "title",
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{value}</Typography.Text>
          {record.type ? <Tag color="blue">{record.type}</Tag> : null}
        </Space>
      ),
    },
    {
      title: "删除时间",
      dataIndex: "deleted_at",
      width: 200,
      render: (value?: string | null) => (value ? new Date(value).toLocaleString() : "-")
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: unknown, record: Document) => {
        const restoreLoading = restoreLoadingId === record.id;
        const purgeLoading = purgeLoadingId === record.id;
        return (
          <Space>
            <Button
              icon={<UndoOutlined />}
              type="primary"
              onClick={() => onRestore(record)}
              loading={restoreLoading}
            >
              恢复
            </Button>
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={() => onPurge(record)}
              loading={purgeLoading}
            >
              彻底删除
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Drawer
      title="文档回收站"
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onRefresh}>刷新</Button>
          <Button type="primary" onClick={handleSearch} icon={<SearchOutlined />}>筛选</Button>
        </Space>
      }
    >
      <Form
        layout="inline"
        form={form}
        style={{ marginBottom: 16, gap: 16, flexWrap: "wrap" }}
        onFinish={handleSearch}
      >
        <Form.Item name="query" label="关键字">
          <Input allowClear placeholder="标题关键词" style={{ width: 240 }} onPressEnter={handleSearch} />
        </Form.Item>
      </Form>

      {error ? (
        <Alert type="error" message="回收站加载失败" description={(error as Error).message} showIcon style={{ marginBottom: 16 }} />
      ) : null}

      {(!data || data.total === 0) && !loading ? (
        <Empty description="暂无已删除文档" />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={loading}
          pagination={{
            current: data?.page ?? 1,
            pageSize: data?.size ?? 20,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: onPageChange,
            showTotal: (total) => `共 ${total} 条` ,
          }}
        />
      )}
    </Drawer>
  );
};
