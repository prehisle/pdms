import { useState, useEffect } from "react";
import {
  Form,
  Input,
  Modal,
  Select,
  DatePicker,
  Alert,
  Space,
  Button,
  Typography,
  message,
} from "antd";
import { CopyOutlined, KeyOutlined, CheckCircleOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import {
  createAPIKey,
  type CreateAPIKeyRequest,
  type CreateAPIKeyResponse,
} from "../../../api/apikeys";
import { listUsers } from "../../../api/users";
import { useAuth } from "../../../contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

const { Text, Paragraph } = Typography;

interface APIKeyCreateFormValues {
  name: string;
  user_id: number;
  environment: "dev" | "test" | "prod";
  expires_at?: Dayjs;
}

interface APIKeyCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function APIKeyCreateModal({
  open,
  onClose,
  onSuccess,
}: APIKeyCreateModalProps) {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<APIKeyCreateFormValues>();
  const [createdAPIKey, setCreatedAPIKey] = useState<CreateAPIKeyResponse | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  // 获取用户列表
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: open,
  });

  const isSuperAdmin = currentUser?.role === "super_admin";

  // 重置状态
  useEffect(() => {
    if (!open) {
      setCreatedAPIKey(null);
      setCopied(false);
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = async (values: APIKeyCreateFormValues) => {
    if (!isSuperAdmin) {
      message.error("只有超级管理员可以创建 API Key");
      return;
    }

    setLoading(true);
    try {
      const payload: CreateAPIKeyRequest = {
        name: values.name.trim(),
        user_id: values.user_id,
        environment: values.environment,
        expires_at: values.expires_at?.toISOString(),
      };

      const response = await createAPIKey(payload);
      setCreatedAPIKey(response);
      message.success("API Key 创建成功！");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "创建 API Key 失败，请重试",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdAPIKey) return;

    try {
      await navigator.clipboard.writeText(createdAPIKey.api_key);
      setCopied(true);
      message.success("API Key 已复制到剪贴板");

      // 3秒后重置复制状态
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      message.error("复制失败，请手动复制");
    }
  };

  const handleClose = () => {
    if (createdAPIKey) {
      // 如果已创建 API Key，调用成功回调刷新列表
      onSuccess();
    }
    form.resetFields();
    setCreatedAPIKey(null);
    setCopied(false);
    onClose();
  };

  // 如果 API Key 已创建，显示 API Key
  if (createdAPIKey) {
    return (
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
            <span>API Key 创建成功</span>
          </Space>
        }
        open={open}
        onCancel={handleClose}
        footer={[
          <Button key="close" type="primary" onClick={handleClose}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Alert
            message="重要提示"
            description="这是您唯一一次看到完整的 API Key。请立即复制并妥善保管，关闭此窗口后将无法再次查看。"
            type="warning"
            showIcon
          />

          <div>
            <Text strong>API Key：</Text>
            <Paragraph
              copyable={{
                text: createdAPIKey.api_key,
                onCopy: handleCopy,
              }}
              code
              style={{
                fontSize: "14px",
                marginTop: "8px",
                padding: "12px",
                background: "#f5f5f5",
                border: "1px solid #d9d9d9",
                borderRadius: "4px",
                wordBreak: "break-all",
              }}
            >
              {createdAPIKey.api_key}
            </Paragraph>
          </div>

          <Button
            type="primary"
            icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />}
            onClick={handleCopy}
            block
            size="large"
          >
            {copied ? "已复制" : "复制 API Key"}
          </Button>

          <div>
            <Text type="secondary">名称：</Text>
            <Text>{createdAPIKey.key_info.name}</Text>
          </div>
          <div>
            <Text type="secondary">关联用户：</Text>
            <Text>
              {createdAPIKey.key_info.user?.username ||
                `ID: ${createdAPIKey.key_info.user_id}`}
            </Text>
          </div>
        </Space>
      </Modal>
    );
  }

  // 创建表单
  return (
    <Modal
      title="创建 API Key"
      open={open}
      onOk={() => form.submit()}
      onCancel={handleClose}
      confirmLoading={loading}
      okButtonProps={{ disabled: !isSuperAdmin }}
      okText="创建"
      cancelText="取消"
      destroyOnClose
      width={500}
    >
      <Form
        form={form}
        name="createAPIKey"
        onFinish={handleSubmit}
        autoComplete="off"
        layout="vertical"
      >
        <Form.Item
          label="名称"
          name="name"
          rules={[
            { required: true, message: "请输入 API Key 名称" },
            { min: 3, message: "名称至少 3 个字符" },
            { max: 100, message: "名称最多 100 个字符" },
          ]}
          tooltip="为 API Key 设置一个描述性名称，方便识别用途"
        >
          <Input
            prefix={<KeyOutlined />}
            placeholder="例如：批量导入工具"
            maxLength={100}
          />
        </Form.Item>

        <Form.Item
          label="关联用户"
          name="user_id"
          rules={[{ required: true, message: "请选择关联用户" }]}
          tooltip="API Key 将继承该用户的角色和权限"
        >
          <Select
            placeholder="选择用户"
            loading={!usersData}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
            options={usersData?.users.map((user) => ({
              value: user.id,
              label: `${user.username} (${user.role})`,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="环境"
          name="environment"
          rules={[{ required: true, message: "请选择环境" }]}
          initialValue="prod"
          tooltip="用于区分不同环境的 API Key，影响密钥前缀"
        >
          <Select
            options={[
              { value: "dev", label: "开发环境 (dev)" },
              { value: "test", label: "测试环境 (test)" },
              { value: "prod", label: "生产环境 (prod)" },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="过期时间"
          name="expires_at"
          tooltip="留空表示永不过期"
        >
          <DatePicker
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择过期时间（可选）"
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Alert
          message="API Key 将以 SHA256 哈希方式存储，创建后仅显示一次完整密钥"
          type="info"
          showIcon
        />
      </Form>
    </Modal>
  );
}
