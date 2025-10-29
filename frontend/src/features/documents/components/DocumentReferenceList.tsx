import { DeleteOutlined, FileTextOutlined, LinkOutlined } from "@ant-design/icons";
import { Button, Card, Empty, List, message, Popconfirm, Space, Spin, Typography } from "antd";
import { useState } from "react";
import {
  type Document,
  type DocumentReference,
  removeDocumentReference,
} from "../../../api/documents";

const { Text, Link } = Typography;

interface DocumentReferenceListProps {
  document: Document;
  canEdit?: boolean;
  onReferenceRemoved?: (document: Document) => void;
  onDocumentClick?: (docId: number) => void;
}

export function DocumentReferenceList({
  document,
  canEdit = false,
  onReferenceRemoved,
  onDocumentClick,
}: DocumentReferenceListProps) {
  const [loading, setLoading] = useState(false);

  const references = (document.metadata?.references as DocumentReference[]) || [];

  const handleRemoveReference = async (refDocId: number) => {
    try {
      setLoading(true);
      const updatedDoc = await removeDocumentReference(document.id, refDocId);
      message.success("引用已删除");
      onReferenceRemoved?.(updatedDoc);
    } catch (error) {
      console.error("Failed to remove reference:", error);
      message.error("删除引用失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentClick = (docId: number) => {
    if (onDocumentClick) {
      onDocumentClick(docId);
    } else {
      // 默认行为：在新标签页打开文档
      window.open(`/documents/${docId}`, "_blank");
    }
  };

  if (references.length === 0) {
    return (
      <Card
        title={
          <Space>
            <LinkOutlined />
            <span>引用的文档</span>
          </Space>
        }
        size="small"
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无引用文档"
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <LinkOutlined />
          <span>引用的文档 ({references.length})</span>
        </Space>
      }
      size="small"
    >
      <Spin spinning={loading}>
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
      </Spin>
    </Card>
  );
}
