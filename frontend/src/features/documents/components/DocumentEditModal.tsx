import type { FC } from "react";

import { Form, Input, InputNumber, Modal, Select, Typography } from "antd";
import type { FormInstance } from "antd/es/form";

import type { Document } from "../../../api/documents";
import type { DocumentFormValues } from "../types";

interface DocumentEditModalProps {
  open: boolean;
  confirmLoading: boolean;
  document: Document | null;
  form: FormInstance<DocumentFormValues>;
  documentTypes: { value: string; label: string }[];
  onCancel: () => void;
  onOk: () => void;
}

export const DocumentEditModal: FC<DocumentEditModalProps> = ({
  open,
  confirmLoading,
  document,
  form,
  documentTypes,
  onCancel,
  onOk,
}) => (
  <Modal
    title="编辑文档"
    open={open}
    confirmLoading={confirmLoading}
    onCancel={onCancel}
    onOk={onOk}
    destroyOnClose
    width={800}
  >
    {document ? (
      <Typography.Paragraph type="secondary">文档 ID：{document.id}</Typography.Paragraph>
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
      <Form.Item
        name="position"
        label="排序位置"
        tooltip="数字越小排序越靠前"
      >
        <InputNumber
          placeholder="可选，指定排序位置"
          min={1}
          style={{ width: "100%" }}
        />
      </Form.Item>
      <Form.Item
        name="content"
        label="文档内容"
        tooltip="文档的实际内容，支持HTML（概览）或YAML（其他类型）格式"
      >
        <Input.TextArea
          rows={15}
          placeholder="请输入文档内容..."
          style={{ fontFamily: "monospace", fontSize: "13px" }}
        />
      </Form.Item>
    </Form>
  </Modal>
);
