import { LinkOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Empty, List, message, Popconfirm, Space, Spin, Typography } from "antd";
import { useState } from "react";
import {
  addDocumentReference,
  removeDocumentReference,
  type Document,
  type DocumentReference,
} from "../../../api/documents";
import { DocumentTreeSelector } from "./DocumentTreeSelector";
import { DeleteOutlined, FileTextOutlined } from "@ant-design/icons";

const { Text, Link } = Typography;

interface DocumentReferenceManagerProps {
  document: Document;
  canEdit?: boolean;
  onDocumentUpdated?: (document: Document) => void;
}

export function DocumentReferenceManager({
  document,
  canEdit = false,
  onDocumentUpdated,
}: DocumentReferenceManagerProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const references = (document.metadata?.references as DocumentReference[]) || [];
  const excludeDocIds = [
    document.id,
    ...references.map((ref) => ref.document_id),
  ];

  const handleAddReference = async (selectedDoc: Document) => {
    try {
      setLoading(true);
      const updatedDoc = await addDocumentReference(document.id, {
        document_id: selectedDoc.id,
      });
      message.success(`已添加引用：${selectedDoc.title}`);
      setSelectorOpen(false);
      onDocumentUpdated?.(updatedDoc);
    } catch (error: any) {
      console.error("Failed to add reference:", error);
      const errorMsg = error?.message || "添加引用失败";
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveReference = async (refDocId: number) => {
    try {
      setLoading(true);
      const updatedDoc = await removeDocumentReference(document.id, refDocId);
      message.success("引用已删除");
      onDocumentUpdated?.(updatedDoc);
    } catch (error) {
      console.error("Failed to remove reference:", error);
      message.error("删除引用失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentClick = (docId: number) => {
    // 在新标签页打开文档
    window.open(`/documents/${docId}`, "_blank");
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Space>
            <LinkOutlined />
            <Typography.Text strong>引用的文档 ({references.length})</Typography.Text>
          </Space>
          {canEdit && (
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setSelectorOpen(true)}
              loading={loading}
            >
              添加引用
            </Button>
          )}
        </div>

        <Spin spinning={loading}>
          {references.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无引用文档"
              style={{ padding: "20px 0" }}
            />
          ) : (
            <List
              size="small"
              dataSource={references}
              renderItem={(ref) => (
                <List.Item
                  actions={
                    canEdit
                      ? [
                          <Popconfirm
                            key="delete"
                            title="确认删除引用？"
                            description="这只会删除引用关系，不会删除被引用的文档"
                            onConfirm={() => handleRemoveReference(ref.document_id)}
                            okText="确认"
                            cancelText="取消"
                          >
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Popconfirm>,
                        ]
                      : undefined
                  }
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: 16 }} />}
                    title={
                      <Link
                        onClick={() => handleDocumentClick(ref.document_id)}
                        style={{ cursor: "pointer" }}
                      >
                        {ref.title}
                      </Link>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        添加于 {new Date(ref.added_at).toLocaleDateString()}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Spin>
      </Space>

      <DocumentTreeSelector
        open={selectorOpen}
        onCancel={() => setSelectorOpen(false)}
        onSelect={handleAddReference}
        excludeDocIds={excludeDocIds}
        title="选择要引用的文档"
      />
    </div>
  );
}
