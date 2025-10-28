import { useCallback } from "react";
import type { DragEvent } from "react";
import type { MessageInstance } from "antd/es/message/interface";
import { Modal, Button, Space, Typography } from "antd";

import type { Document } from "../../../api/documents";
import { bindDocument, unbindDocument, getDocumentBindingStatus } from "../../../api/documents";

const { Paragraph, Text } = Typography;

interface UseDocumentDragParams {
  selectedNodeId: number | null;
  messageApi: MessageInstance;
  onInvalidateQueries: () => Promise<void>;
}

interface DragData {
  type: "document";
  documentId: number;
  sourceNodeId: number;
}

export function useDocumentDrag({
  selectedNodeId,
  messageApi,
  onInvalidateQueries,
}: UseDocumentDragParams) {
  const handleDocumentDragStart = useCallback(
    (event: DragEvent<HTMLElement>, document: Document) => {
      if (selectedNodeId == null) {
        event.preventDefault();
        return;
      }

      const dragData: DragData = {
        type: "document",
        documentId: document.id,
        sourceNodeId: selectedNodeId,
      };

      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData("application/json", JSON.stringify(dragData));

      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.style.opacity = "0.5";
      }
    },
    [selectedNodeId],
  );

  const handleDocumentDragEnd = useCallback((event: DragEvent<HTMLElement>) => {
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDropOnNode = useCallback(
    async (targetNodeId: number, dragData: DragData) => {
      const { documentId } = dragData;

      try {
        const bindingStatus = await getDocumentBindingStatus(documentId);

        const alreadyBoundToTarget = bindingStatus.node_ids.includes(targetNodeId);
        if (bindingStatus.total_bindings === 1 && alreadyBoundToTarget) {
          messageApi.info("文档已在当前目录中");
          return;
        }

        const modalRef: { current: ReturnType<typeof Modal.confirm> | null } = { current: null };

        const closeModal = () => {
          modalRef.current?.destroy();
        };

        const copyToTarget = async () => {
          if (alreadyBoundToTarget) {
            messageApi.info("文档已在目标目录中");
            closeModal();
            return;
          }
          try {
            messageApi.open({
              type: "loading",
              content: "正在复制文档到目标目录…",
              key: "document-dnd",
            });
            await bindDocument(targetNodeId, documentId);
            messageApi.success({ content: "文档已复制到目标目录", key: "document-dnd" });
            await onInvalidateQueries();
          } catch (error) {
            messageApi.error({
              content: "复制失败：" + (error as Error).message,
              key: "document-dnd",
            });
          } finally {
            closeModal();
          }
        };

        const moveToTarget = async () => {
          const isAlreadyBoundToTarget = bindingStatus.node_ids.includes(targetNodeId);

          messageApi.open({
            type: "loading",
            content: "正在移动文档…",
            key: "document-dnd",
          });

          try {
            for (const nodeId of bindingStatus.node_ids) {
              if (nodeId !== targetNodeId) {
                await unbindDocument(nodeId, documentId);
              }
            }

            if (!isAlreadyBoundToTarget) {
              await bindDocument(targetNodeId, documentId);
            }

            messageApi.success({ content: "文档已移动到目标目录", key: "document-dnd" });
            await onInvalidateQueries();
          } catch (error) {
            messageApi.error({
              content: "移动失败：" + (error as Error).message,
              key: "document-dnd",
            });
          } finally {
            closeModal();
          }
        };

        const currentBindingsText =
          bindingStatus.total_bindings > 1
            ? `当前文档关联到 ${bindingStatus.total_bindings} 个目录。`
            : "当前文档关联到 1 个目录。";

        modalRef.current = Modal.confirm({
          title: "选择操作",
          icon: null,
          closable: true,
          maskClosable: true,
          onCancel: () => {
            closeModal();
          },
          content: (
            <Space direction="vertical" size="middle" style={{ width: "100%" }} align="start">
              <Paragraph style={{ marginBottom: 0 }}>{currentBindingsText}</Paragraph>
              <Paragraph style={{ marginBottom: 0 }}>请选择操作方式：</Paragraph>
              <Space direction="vertical" size={4} style={{ width: "100%" }} align="start">
                <Paragraph style={{ marginBottom: 0 }}>
                  <Text strong>• 移动到此处</Text>
                </Paragraph>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  从所有目录移除，仅在目标目录显示。
                </Paragraph>
              </Space>
              <Space direction="vertical" size={4} style={{ width: "100%" }} align="start">
                <Paragraph style={{ marginBottom: 0 }}>
                  <Text strong>• 复制到此处</Text>
                </Paragraph>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  保留现有关联，同时添加到目标目录。
                </Paragraph>
              </Space>
            </Space>
          ),
          footer: (
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={closeModal}>取消</Button>
              <Button onClick={() => void copyToTarget()}>复制到此处</Button>
              <Button type="primary" onClick={() => void moveToTarget()}>
                移动到此处
              </Button>
            </Space>
          ),
        });
      } catch (error) {
        messageApi.error("获取文档信息失败：" + (error as Error).message);
      }
    },
    [messageApi, onInvalidateQueries],
  );

  return {
    handleDocumentDragStart,
    handleDocumentDragEnd,
    handleDropOnNode,
  };
}
