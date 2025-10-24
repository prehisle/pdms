import { type FC, useEffect, useState } from "react";

import { Alert, Form, Input, InputNumber, Modal, Select, Typography } from "antd";
import type { FormInstance } from "antd/es/form";

import type { DocumentFormValues } from "../types";
import { getDocumentTemplate } from "../templates";

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
}) => {
  const [templateLoaded, setTemplateLoaded] = useState(false);

  useEffect(() => {
    if (!open) {
      setTemplateLoaded(false);
      return;
    }

    // Watch for type field changes
    const currentType = form.getFieldValue("type");
    if (currentType && !templateLoaded) {
      const template = getDocumentTemplate(currentType);
      if (template) {
        form.setFieldsValue({ content: template.data });
        setTemplateLoaded(true);
      }
    }
  }, [open, form, templateLoaded]);

  const handleTypeChange = (value: string) => {
    const template = getDocumentTemplate(value);
    if (template) {
      form.setFieldsValue({ content: template.data });
      setTemplateLoaded(true);
    }
  };

  return (
    <Modal
      title="添加文档"
      open={open}
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={onOk}
      destroyOnClose
      width={800}
    >
      {nodeId ? (
        <Typography.Paragraph type="secondary">绑定目录 ID：{nodeId}</Typography.Paragraph>
      ) : null}
      <Alert
        message="提示"
        description="选择文档类型后会自动填充对应的模板格式，您可以根据需要修改模板内容。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
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
          <Select options={documentTypes} placeholder="请选择" onChange={handleTypeChange} />
        </Form.Item>
        <Form.Item
          name="position"
          label="排序位置"
          tooltip="数字越小排序越靠前，如果不指定则自动排到最后"
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
            placeholder="选择文档类型后会自动填充模板..."
            style={{ fontFamily: "monospace", fontSize: "13px" }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
