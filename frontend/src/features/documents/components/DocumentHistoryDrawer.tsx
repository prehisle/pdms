import { type FC, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Button,
  Drawer,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { HistoryOutlined, UndoOutlined } from "@ant-design/icons";
import Editor from "@monaco-editor/react";

import type { DocumentVersion, DocumentVersionsPage } from "../../../api/documents";
import { HTMLPreview } from "./HTMLPreview";
import { YAMLPreview } from "./YAMLPreview";

interface DocumentHistoryDrawerProps {
  open: boolean;
  documentTitle?: string;
  loading: boolean;
  data?: DocumentVersionsPage;
  error?: unknown;
  onClose: () => void;
  onPageChange: (page: number, pageSize?: number) => void;
  onRestore: (version: DocumentVersion) => void;
  restoreLoadingVersion?: number | null;
}

const { Paragraph, Text, Title } = Typography;

function extractVersionContent(version: DocumentVersion | null) {
  if (!version || !version.content) {
    return { data: "", format: version?.type === "overview" ? "html" : "yaml" };
  }
  const content = version.content as Record<string, unknown>;
  const rawData = typeof content.data === "string" ? content.data : "";
  const previewData = typeof content.preview === "string" ? content.preview : "";
  const serialized =
    rawData ||
    previewData ||
    (() => {
      try {
        return JSON.stringify(content, null, 2);
      } catch {
        return String(content);
      }
    })();

  let format: string | undefined;
  if (typeof content.format === "string") {
    format = content.format.toLowerCase();
  } else if (version.type) {
    format = version.type === "overview" ? "html" : "yaml";
  }
  if (!format) {
    format = "yaml";
  }
  return { data: serialized, format };
}

export const DocumentHistoryDrawer: FC<DocumentHistoryDrawerProps> = ({
  open,
  documentTitle,
  loading,
  data,
  error,
  onClose,
  onPageChange,
  onRestore,
  restoreLoadingVersion,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);

  const versionList = useMemo(() => {
    if (!data) return [] as DocumentVersion[];
    if (Array.isArray(data.versions) && data.versions.length > 0) {
      return data.versions;
    }
    if (Array.isArray(data.items) && data.items.length > 0) {
      return data.items;
    }
    return [] as DocumentVersion[];
  }, [data]);

  useEffect(() => {
    if (!open) {
      setSelectedVersion(null);
      return;
    }
    if (versionList.length === 0) {
      setSelectedVersion(null);
      return;
    }
    if (selectedVersion) {
      const match = versionList.find((v) => v.version_number === selectedVersion.version_number);
      if (match) {
        setSelectedVersion(match);
        return;
      }
    }
    setSelectedVersion(versionList[0]);
  }, [open, versionList, selectedVersion]);

  const preview = useMemo(() => extractVersionContent(selectedVersion), [selectedVersion]);
  const previewContent = preview.data;
  const previewFormat = preview.format;

  const previewDocumentType = selectedVersion?.type || "overview";

  const columns: ColumnsType<DocumentVersion> = [
    {
      title: "版本",
      dataIndex: "version_number",
      width: 100,
      render: (value: number) => <Tag color="geekblue">v{value}</Tag>,
    },
    {
      title: "更新时间",
      dataIndex: "created_at",
      width: 200,
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "作者",
      dataIndex: "created_by",
      width: 140,
      render: (value: string) => <Text>{value || "-"}</Text>,
    },
    {
      title: "变更备注",
      dataIndex: "change_message",
      ellipsis: true,
      render: (value?: string | null) => value || "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_: unknown, record: DocumentVersion) => (
        <Button
          type="link"
          icon={<UndoOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            onRestore(record);
          }}
          loading={restoreLoadingVersion === record.version_number}
        >
          恢复
        </Button>
      ),
    },
  ];

  const tableData = versionList;
  const selectedVersionNumber = selectedVersion?.version_number;

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>历史版本 - {documentTitle ?? ""}</span>
        </Space>
      }
      width="100%"
      open={open}
      onClose={onClose}
      destroyOnClose
      styles={{
        body: {
          padding: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {error ? (
        <Alert
          type="error"
          message="历史版本加载失败"
          description={(error as Error).message}
          showIcon
          style={{ margin: 24 }}
        />
      ) : null}

      <div style={{ padding: 24, flex: "0 0 auto" }}>
        <Table<DocumentVersion>
          rowKey={(record) => `${record.document_id}-${record.version_number}`}
          columns={columns}
          dataSource={tableData}
          loading={loading}
          pagination={{
            current: data?.page ?? 1,
            pageSize: data?.size ?? 10,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: onPageChange,
            showTotal: (total) => `共 ${total} 个版本`,
          }}
          onRow={(record) => ({
            onClick: () => setSelectedVersion(record),
          })}
          rowClassName={(record) =>
            record.version_number === selectedVersionNumber ? "document-history-selected-row" : ""
          }
        />

        {tableData.length === 0 && !loading ? <Empty description="暂无历史版本" /> : null}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 16,
          padding: "0 24px 24px",
          borderTop: "1px solid #f0f0f0",
          background: "#fafafa",
        }}
      >
        {selectedVersion ? (
          <>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: "#0f172a",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
              <Space align="center" size={16}>
                <Title level={5} style={{ margin: 0, color: "#e2e8f0" }}>
                  版本 v{selectedVersion.version_number}
                </Title>
                <Text style={{ color: "#94a3b8" }}>
                  更新于 {new Date(selectedVersion.created_at).toLocaleString()} ，操作者{" "}
                  {selectedVersion.created_by || "-"}
                </Text>
              </Space>
            </div>
            {selectedVersion.change_message ? (
                <Alert message={`备注：${selectedVersion.change_message}`} type="info" showIcon />
              ) : null}
              <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                  language={previewFormat === "html" ? "html" : "yaml"}
                  value={previewContent}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    lineNumbers: "on",
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                  }}
                  theme="vs-dark"
                />
              </div>
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #e0e0e0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #f0f0f0",
                  fontWeight: 500,
                }}
              >
                渲染预览
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
                {previewFormat === "html" ? (
                  <HTMLPreview content={previewContent} />
                ) : (
                  <YAMLPreview content={previewContent} documentType={previewDocumentType} />
                )}
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              borderRadius: 8,
              border: "1px dashed #d9d9d9",
            }}
          >
            <Empty description="请选择一个版本以查看详情" />
          </div>
        )}
      </div>
    </Drawer>
  );
};
