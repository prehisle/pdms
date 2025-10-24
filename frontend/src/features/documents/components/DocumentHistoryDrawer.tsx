import { type FC, useEffect, useMemo, useState } from "react";

import {
  Alert,
  Button,
  Drawer,
  Empty,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { HistoryOutlined, UndoOutlined } from "@ant-design/icons";

import type { DocumentVersion, DocumentVersionsPage } from "../../../api/documents";

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

  useEffect(() => {
    if (!open) {
      setSelectedVersion(null);
      return;
    }
    const versions = data?.versions ?? [];
    if (versions.length === 0) {
      setSelectedVersion(null);
      return;
    }
    if (selectedVersion) {
      const match = versions.find((v) => v.version_number === selectedVersion.version_number);
      if (match) {
        setSelectedVersion(match);
        return;
      }
    }
    setSelectedVersion(versions[0]);
  }, [open, data, selectedVersion]);

  const previewContent = useMemo(() => {
    if (!selectedVersion || !selectedVersion.content) {
      return "";
    }
    try {
      return JSON.stringify(selectedVersion.content, null, 2);
    } catch {
      return String(selectedVersion.content);
    }
  }, [selectedVersion]);

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
  ];

  const tableData = data?.versions ?? [];
  const selectedVersionNumber = selectedVersion?.version_number;

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>历史版本 - {documentTitle ?? ""}</span>
        </Space>
      }
      width={920}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      {error ? (
        <Alert
          type="error"
          message="历史版本加载失败"
          description={(error as Error).message}
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : null}

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

      {tableData.length === 0 && !loading ? (
        <Empty description="暂无历史版本" />
      ) : null}

      {selectedVersion ? (
        <div style={{ marginTop: 24 }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Space align="center" size={24}>
              <Title level={5} style={{ margin: 0 }}>
                版本 v{selectedVersion.version_number}
              </Title>
              <Text type="secondary">
                更新于 {new Date(selectedVersion.created_at).toLocaleString()} ，操作者 {selectedVersion.created_by || "-"}
              </Text>
              <Button
                type="primary"
                icon={<UndoOutlined />}
                onClick={() => onRestore(selectedVersion)}
                loading={restoreLoadingVersion === selectedVersion.version_number}
              >
                恢复此版本
              </Button>
            </Space>
            {selectedVersion.change_message ? (
              <Alert type="info" message={`备注：${selectedVersion.change_message}`} showIcon />
            ) : null}
            <div style={{ background: "#0f172a", color: "#fff", padding: 16, borderRadius: 8 }}>
              <Paragraph style={{ color: "#94a3b8" }}>内容预览</Paragraph>
              <pre
                style={{
                  margin: 0,
                  maxHeight: 320,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {previewContent || "(无内容)"}
              </pre>
            </div>
          </Space>
        </div>
      ) : null}
    </Drawer>
  );
};
