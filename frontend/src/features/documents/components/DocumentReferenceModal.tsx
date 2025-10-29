import { LinkOutlined, PlusOutlined, FileTextOutlined, DeleteOutlined } from "@ant-design/icons";
import { Modal, Button, Empty, List, message, Popconfirm, Space, Spin, Typography, Tag } from "antd";
import { useState } from "react";
import {
  addDocumentReference,
  removeDocumentReference,
  type Document,
  type DocumentReference,
} from "../../../api/documents";
import { DocumentTreeSelector } from "./DocumentTreeSelector";

const { Text, Link } = Typography;

interface PendingReference {
  document_id: number;
  title: string;
}

interface DocumentReferenceModalProps {
  open: boolean;
  onCancel: () => void;
  // 编辑模式：传入现有文档
  document?: Document;
  onDocumentUpdated?: (document: Document) => void;
  // 新建模式：传入待添加的引用列表
  pendingReferences?: PendingReference[];
  onPendingAdd?: (doc: Document) => void;
  onPendingRemove?: (docId: number) => void;
}

export function DocumentReferenceModal({
  open,
  onCancel,
  document,
  onDocumentUpdated,
  pendingReferences,
  onPendingAdd,
  onPendingRemove,
}: DocumentReferenceModalProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 确定是编辑模式还是新建模式
  const isEditMode = !!document;
  const references = isEditMode
    ? ((document.metadata?.references as DocumentReference[]) || [])
    : (pendingReferences || []).map((ref) => ({
        document_id: ref.document_id,
        title: ref.title,
        added_at: new Date().toISOString(), // 新建模式使用当前时间作为占位
      }));

  const excludeDocIds = isEditMode
    ? [document.id, ...references.map((ref) => ref.document_id)]
    : references.map((ref) => ref.document_id);

  const handleAddReference = async (selectedDoc: Document) => {
    try {
      setLoading(true);

      if (isEditMode) {
        // 编辑模式：调用API添加引用
        const updatedDoc = await addDocumentReference(document.id, {
          document_id: selectedDoc.id,
        });
        message.success(`已添加引用：${selectedDoc.title}`);
        onDocumentUpdated?.(updatedDoc);
      } else {
        // 新建模式：添加到待添加列表
        onPendingAdd?.(selectedDoc);
        message.success(`已添加引用：${selectedDoc.title}（文档创建后生效）`);
      }

      setSelectorOpen(false);
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

      if (isEditMode) {
        // 编辑模式：调用API删除引用
        const updatedDoc = await removeDocumentReference(document.id, refDocId);
        message.success("引用已删除");
        onDocumentUpdated?.(updatedDoc);
      } else {
        // 新建模式：从待添加列表中移除
        onPendingRemove?.(refDocId);
        message.success("已移除引用");
      }
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
    <>
      <Modal
        title={
          <Space>
            <LinkOutlined />
            <span>引用的文档</span>
            {!isEditMode && <Tag color="blue">新建模式</Tag>}
          </Space>
        }
        open={open}
        onCancel={onCancel}
        width={700}
        footer={[
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography.Text>
              共 {references.length} 个引用
              {!isEditMode && references.length > 0 && (
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  （文档创建后生效）
                </Text>
              )}
            </Typography.Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setSelectorOpen(true)}
              loading={loading}
            >
              添加引用
            </Button>
          </div>

          <Spin spinning={loading}>
            {references.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无引用文档"
                style={{ padding: "40px 0" }}
              />
            ) : (
              <List
                size="small"
                dataSource={references}
                style={{ maxHeight: 400, overflowY: "auto" }}
                renderItem={(ref) => (
                  <List.Item
                    actions={[
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
                    ]}
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
                        isEditMode ? (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            添加于 {new Date(ref.added_at).toLocaleDateString()}
                          </Text>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            待添加
                          </Text>
                        )
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Spin>
        </Space>
      </Modal>

      <DocumentTreeSelector
        open={selectorOpen}
        onCancel={() => setSelectorOpen(false)}
        onSelect={handleAddReference}
        excludeDocIds={excludeDocIds}
        title="选择要引用的文档"
      />
    </>
  );
}
