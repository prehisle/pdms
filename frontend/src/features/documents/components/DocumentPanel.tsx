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
import {
  PlusOutlined,
  SearchOutlined,
  FileTextOutlined,
  SortAscendingOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";

import type { Document } from "../../../api/documents";
import type { DocumentFilterFormValues, MetadataFilterFormValue, MetadataValueType } from "../types";

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
        <Form.Item style={{ width: "100%", marginBottom: 0 }}>
          <MetadataFiltersField filterForm={filterForm} onReset={onReset} />
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

const metadataFilterTypeOptions = [
  { value: "string", label: "字符串" },
  { value: "number", label: "数字" },
  { value: "boolean", label: "布尔" },
  { value: "string[]", label: "字符串数组" },
];

const MetadataFiltersField: FC<{
  filterForm: FormInstance<DocumentFilterFormValues>;
  onReset: () => void;
}> = ({ filterForm, onReset }) => (
  <Form.List name="metadataFilters">
    {(fields, { add, remove }) => {
      const metadataFilters = filterForm.getFieldValue("metadataFilters") ?? [];
      return (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space align="center" wrap>
            <Typography.Text strong>元数据条件</Typography.Text>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => add({ type: "string", value: "" })}
            >
              添加条件
            </Button>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                筛选
              </Button>
              <Button onClick={onReset}>重置</Button>
            </Space>
          </Space>
          {fields.length === 0 ? null : (
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {fields.map((field) => {
                const index = typeof field.name === "number" ? field.name : Number(field.name);
                const currentFilter: MetadataFilterFormValue = metadataFilters?.[index] ?? {};
                const currentType: MetadataValueType = currentFilter?.type ?? "string";
                return (
                  <Space
                    key={field.key}
                    wrap
                    align="start"
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid #f0f0f0",
                      borderRadius: 6,
                      background: "#fafafa",
                    }}
                  >
                    <Form.Item
                      {...field}
                      name={[field.name, "key"]}
                      fieldKey={[field.fieldKey ?? field.name, "key"]}
                      rules={[{ required: true, message: "请输入元数据键" }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="键" allowClear style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "type"]}
                      fieldKey={[field.fieldKey ?? field.name, "type"]}
                      initialValue="string"
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        style={{ width: 140 }}
                        options={metadataFilterTypeOptions}
                        onChange={(value: MetadataValueType) =>
                          handleFilterTypeChange(filterForm, field.name, value)
                        }
                      />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "value"]}
                      fieldKey={[field.fieldKey ?? field.name, "value"]}
                      style={{ marginBottom: 0 }}
                    >
                      {renderMetadataFilterValueInput(currentType)}
                    </Form.Item>
                    <Button
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                    />
                  </Space>
                );
              })}
            </Space>
          )}
        </Space>
      );
    }}
  </Form.List>
);

function handleFilterTypeChange(
  form: FormInstance<DocumentFilterFormValues>,
  index: number,
  nextType: MetadataValueType,
) {
  const currentFilters: MetadataFilterFormValue[] = form.getFieldValue("metadataFilters") ?? [];
  const nextFilters = [...currentFilters];
  const previous = nextFilters[index]?.value;
  nextFilters[index] = {
    ...(nextFilters[index] ?? {}),
    type: nextType,
    value: getDefaultFilterValueForType(nextType, previous),
  };
  form.setFieldsValue({ metadataFilters: nextFilters });
}

function getDefaultFilterValueForType(
  type: MetadataValueType,
  previous?: string | string[],
): string | string[] {
  switch (type) {
    case "number":
      return typeof previous === "string" ? previous : "";
    case "boolean":
      return previous === "false" ? "false" : "true";
    case "string[]":
      if (Array.isArray(previous)) {
        return previous;
      }
      if (typeof previous === "string" && previous.trim()) {
        return [previous.trim()];
      }
      return [];
    case "string":
    default:
      return typeof previous === "string" ? previous : "";
  }
}

function renderMetadataFilterValueInput(type: MetadataValueType) {
  switch (type) {
    case "number":
      return <Input placeholder="数值" allowClear style={{ width: 160 }} inputMode="decimal" />;
    case "boolean":
      return (
        <Select
          style={{ width: 140 }}
          options={[
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ]}
        />
      );
    case "string[]":
      return <Select mode="tags" style={{ minWidth: 220 }} allowClear placeholder="输入多个值" />;
    case "string":
    default:
      return <Input placeholder="值" allowClear style={{ width: 200 }} />;
  }
}
