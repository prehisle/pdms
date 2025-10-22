import type { FC } from "react";

import { Card, Modal, Space, Spin, Typography } from "antd";

import type { CategoryBulkCheckResponse } from "../../../api/categories";

interface CategoryDeletePreviewModalProps {
  open: boolean;
  mode: "soft" | "purge";
  loading: boolean;
  result: CategoryBulkCheckResponse | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const CategoryDeletePreviewModal: FC<CategoryDeletePreviewModalProps> = ({
  open,
  mode,
  loading,
  result,
  confirmLoading,
  onCancel,
  onConfirm,
}) => (
  <Modal
    title={mode === "purge" ? "彻底删除确认" : "删除确认"}
    open={open}
    confirmLoading={confirmLoading}
    onCancel={onCancel}
    onOk={onConfirm}
    okText={mode === "purge" ? "彻底删除" : "删除"}
    cancelButtonProps={{ disabled: confirmLoading }}
    width={520}
  >
    {loading ? (
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
        <Spin />
      </div>
    ) : result ? (
      <Space direction="vertical" style={{ width: "100%" }}>
        {result.items.map((item) => (
          <Card key={item.id} size="small" bordered={false} style={{ border: "1px solid #f0f0f0" }}>
            <Typography.Text strong>{item.name}</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {item.path}
            </Typography.Paragraph>
            <Typography.Text>关联文档：{item.document_count}</Typography.Text>
            {item.warnings && item.warnings.length > 0 ? (
              <ul style={{ paddingLeft: 16, margin: "8px 0 0" }}>
                {item.warnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            ) : (
              <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
                无关联风险
              </Typography.Paragraph>
            )}
          </Card>
        ))}
      </Space>
    ) : (
      <Typography.Paragraph type="secondary">正在加载删除校验信息...</Typography.Paragraph>
    )}
  </Modal>
);
