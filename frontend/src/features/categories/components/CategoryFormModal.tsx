import type { FC } from "react";

import { Form, Input, Modal } from "antd";
import type { FormInstance } from "antd/es/form";

interface CategoryFormModalProps {
  open: boolean;
  title: string;
  confirmLoading: boolean;
  form: FormInstance<{ name: string }>;
  onCancel: () => void;
  onSubmit: () => void;
}

export const CategoryFormModal: FC<CategoryFormModalProps> = ({
  open,
  title,
  confirmLoading,
  form,
  onCancel,
  onSubmit,
}) => (
  <Modal
    title={title}
    open={open}
    confirmLoading={confirmLoading}
    onCancel={onCancel}
    onOk={onSubmit}
    destroyOnClose
  >
    <Form form={form} layout="vertical" preserve={false}>
      <Form.Item
        name="name"
        label="目录名称"
        rules={[
          {
            validator: (_, value: string) => {
              const trimmed = value?.trim() ?? "";
              if (!trimmed) {
                return Promise.reject(new Error("请输入目录名称"));
              }
              if (trimmed.length > 50) {
                return Promise.reject(new Error("名称不超过 50 个字符"));
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <Input placeholder="请输入" />
      </Form.Item>
    </Form>
  </Modal>
);
