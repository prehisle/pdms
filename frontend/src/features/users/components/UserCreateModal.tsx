import { useState } from "react";
import { Form, Input, Modal, Select, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { createUser, type CreateUserRequest, type UserRole } from "../../../api/users";
import { useAuth } from "../../../contexts/AuthContext";

interface UserCreateFormValues {
  username: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  display_name?: string;
}

interface UserCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserCreateModal({ open, onClose, onSuccess }: UserCreateModalProps) {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<UserCreateFormValues>();

  const handleSubmit = async (values: UserCreateFormValues) => {
    if (!isSuperAdmin) {
      message.error("只有超级管理员可以创建用户");
      onClose();
      return;
    }
    setLoading(true);
    try {
      const payload: CreateUserRequest = {
        username: values.username.trim(),
        password: values.password,
        role: values.role,
        display_name: values.display_name?.trim() || undefined,
      };
      await createUser(payload);
      message.success("用户创建成功！");
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "创建用户失败，请重试",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const availableRoles: { value: UserRole; label: string }[] = [
    { value: "super_admin", label: "超级管理员" },
    { value: "course_admin", label: "课程管理员" },
    { value: "proofreader", label: "校对员" },
  ];

  const isSuperAdmin = currentUser?.role === "super_admin";

  return (
    <Modal
      title="创建用户"
      open={open}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      confirmLoading={loading}
      okButtonProps={{ disabled: !isSuperAdmin }}
      okText="创建"
      cancelText="取消"
      destroyOnClose
      width={500}
    >
      <Form
        form={form}
        name="createUser"
        onFinish={handleSubmit}
        autoComplete="off"
        layout="vertical"
      >
        <Form.Item
          label="用户名"
          name="username"
          rules={[
            { required: true, message: "请输入用户名" },
            { min: 3, message: "用户名至少 3 个字符" },
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message: "用户名只能包含字母、数字、下划线和连字符",
            },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label="显示名称"
          name="display_name"
          rules={[{ max: 50, message: "显示名称最多 50 个字符" }]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入显示名称（可选）"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label="角色"
          name="role"
          rules={[{ required: true, message: "请选择角色" }]}
        >
          <Select
            placeholder="请选择角色"
            options={availableRoles}
          />
        </Form.Item>

        <Form.Item
          label="密码"
          name="password"
          rules={[
            { required: true, message: "请输入密码" },
            { min: 8, message: "密码至少 8 个字符" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          label="确认密码"
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: "请确认密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("两次输入的密码不一致"));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请再次输入密码"
            autoComplete="new-password"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
