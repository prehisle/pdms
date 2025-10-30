import { useState } from "react";
import {
  Drawer,
  Button,
  Space,
  Typography,
  Alert,
  message,
  Modal,
  Form,
  Input,
} from "antd";
import { PlusOutlined, CloseOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAPIKeys,
  getAPIKeyStats,
  revokeAPIKey,
  deleteAPIKey,
  updateAPIKey,
  type APIKey,
  type UpdateAPIKeyRequest,
} from "../../api/apikeys";
import { useAuth } from "../../contexts/AuthContext";
import { APIKeyCreateModal } from "./components/APIKeyCreateModal";
import { APIKeyStatsCards } from "./components/APIKeyStatsCards";
import { APIKeyTable } from "./components/APIKeyTable";

const { Title } = Typography;

interface APIKeyManagementDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function APIKeyManagementDrawer({
  open,
  onClose,
}: APIKeyManagementDrawerProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    apiKey: APIKey | null;
  }>({ open: false, apiKey: null });
  const [editForm] = Form.useForm();

  const isSuperAdmin = currentUser?.role === "super_admin";

  // 获取 API Key 列表
  const { data: apiKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: () => listAPIKeys(),
    enabled: open,
  });

  // 获取统计信息
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["apiKeyStats"],
    queryFn: getAPIKeyStats,
    enabled: open,
  });

  // 撤销 API Key
  const revokeMutation = useMutation({
    mutationFn: revokeAPIKey,
    onSuccess: () => {
      messageApi.success("API Key 已撤销");
      void queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      void queryClient.invalidateQueries({ queryKey: ["apiKeyStats"] });
    },
    onError: (err) => {
      messageApi.error(
        err instanceof Error ? err.message : "撤销 API Key 失败",
      );
    },
  });

  // 删除 API Key
  const deleteMutation = useMutation({
    mutationFn: deleteAPIKey,
    onSuccess: () => {
      messageApi.success("API Key 已删除");
      void queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      void queryClient.invalidateQueries({ queryKey: ["apiKeyStats"] });
    },
    onError: (err) => {
      messageApi.error(
        err instanceof Error ? err.message : "删除 API Key 失败",
      );
    },
  });

  // 更新 API Key
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateAPIKeyRequest;
    }) => updateAPIKey(id, data),
    onSuccess: () => {
      messageApi.success("API Key 已更新");
      setEditModal({ open: false, apiKey: null });
      editForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
    onError: (err) => {
      messageApi.error(
        err instanceof Error ? err.message : "更新 API Key 失败",
      );
    },
  });

  const handleEdit = (apiKey: APIKey) => {
    setEditModal({ open: true, apiKey });
    editForm.setFieldsValue({ name: apiKey.name });
  };

  const handleEditSubmit = async () => {
    if (!editModal.apiKey) return;

    try {
      const values = await editForm.validateFields();
      updateMutation.mutate({
        id: editModal.apiKey.id,
        data: { name: values.name },
      });
    } catch (error) {
      // 表单验证失败
    }
  };

  const handleRevoke = (keyId: number) => {
    revokeMutation.mutate(keyId);
  };

  const handleDelete = (keyId: number) => {
    deleteMutation.mutate(keyId);
  };

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    void queryClient.invalidateQueries({ queryKey: ["apiKeyStats"] });
  };

  return (
    <>
      {contextHolder}
      <Drawer
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              API Key 管理
            </Title>
          </Space>
        }
        placement="right"
        size="large"
        onClose={onClose}
        open={open}
        extra={
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
            type="text"
          />
        }
      >
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {!isSuperAdmin && (
            <Alert
              message="权限限制"
              description="只有超级管理员可以创建新的 API Key"
              type="info"
              showIcon
            />
          )}

          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              disabled={!isSuperAdmin}
            >
              创建 API Key
            </Button>
            <Button onClick={handleRefresh}>刷新</Button>
          </Space>

          <APIKeyStatsCards stats={statsData} loading={statsLoading} />

          <APIKeyTable
            dataSource={apiKeysData?.api_keys || []}
            loading={keysLoading}
            isSuperAdmin={isSuperAdmin}
            onEdit={handleEdit}
            onRevoke={handleRevoke}
            onDelete={handleDelete}
          />
        </Space>
      </Drawer>

      <APIKeyCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleRefresh}
      />

      <Modal
        title="编辑 API Key"
        open={editModal.open}
        onOk={handleEditSubmit}
        onCancel={() => {
          setEditModal({ open: false, apiKey: null });
          editForm.resetFields();
        }}
        confirmLoading={updateMutation.isPending}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="名称"
            name="name"
            rules={[
              { required: true, message: "请输入 API Key 名称" },
              { min: 3, message: "名称至少 3 个字符" },
              { max: 100, message: "名称最多 100 个字符" },
            ]}
          >
            <Input placeholder="输入新的名称" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
