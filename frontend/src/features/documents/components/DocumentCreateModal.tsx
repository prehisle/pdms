import type { FC } from "react";

import { Form, Input, Modal, Select, Typography } from "antd";
import type { FormInstance } from "antd/es/form";

import type { DocumentFormValues } from "../types";

interface DocumentCreateModalProps {
  open: boolean;
  confirmLoading: boolean;
  nodeId: number | null;
  form: FormInstance<DocumentFormValues>;
  documentTypes: { value: string; label: string }[];
  onCancel: () => void;
  onOk: () => void;
}

export const DocumentCreateModal: FC<DocumentCreateModalProps> = ({
  open,
  confirmLoading,
  nodeId,
  form,
  documentTypes,
  onCancel,
  onOk,
}) => (
  <Modal
    title="添加文档"
    open={open}
    confirmLoading={confirmLoading}
    onCancel={onCancel}
    onOk={onOk}
    destroyOnClose
  >
    {nodeId ? (
      <Typography.Paragraph type="secondary">绑定目录 ID：{nodeId}</Typography.Paragraph>
    ) : null}
    <Form form={form} layout="vertical" preserve={false}>
      <Form.Item
        name="title"
        label="文档名称"
        rules={[
          { required: true, message: "请输入文档名称" },
          { max: 100, message: "名称不超过 100 个字符" },
        ]}
      >
        <Input placeholder="请输入" autoFocus />
      </Form.Item>
      <Form.Item
        name="type"
        label="文档类型"
        rules={[{ required: true, message: "请选择文档类型" }]}
      >
        <Select options={documentTypes} placeholder="请选择" />
      </Form.Item>
      <Form.Item name="content" label="备注 / 内容预览">
        <Input.TextArea rows={4} placeholder="可选，填写内容概要" />
      </Form.Item>
    </Form>
  </Modal>
);
