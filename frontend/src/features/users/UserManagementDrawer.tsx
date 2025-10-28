import { useState } from "react";
import {
  Button,
  Drawer,
  Space,
  Table,
  Popconfirm,
  Tag,
  Typography,
  Alert,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, DeleteOutlined, SettingOutlined, CloseOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, deleteUser, type User } from "../../api/users";
import { useAuth } from "../../contexts/AuthContext";
import { UserCreateModal } from "./components/UserCreateModal";
import { UserPermissionsModal } from "./components/UserPermissionsModal";

const { Title } = Typography;

interface UserManagementDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function UserManagementDrawer({ open, onClose }: UserManagementDrawerProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [permissionsModal, setPermissionsModal] = useState<{
    open: boolean;
    userId: number | null;
    username: string | null;
  }>({ open: false, userId: null, username: null });

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      messageApi.success("用户已删除");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "删除用户失败";
      messageApi.error(msg);
    },
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "超级管理员";
      case "course_admin":
        return "课程管理员";
      case "proofreader":
        return "校对员";
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "red";
      case "course_admin":
        return "blue";
      case "proofreader":
        return "green";
      default:
        return "default";
    }
  };

  const canManageUsers = currentUser?.role === "super_admin";

  const canDeleteUser = (user: User) => {
    // 超级管理员可以删除任何用户
    return currentUser?.role === "super_admin";
  };

  const handleOpenPermissions = (user: User) => {
    setPermissionsModal({
      open: true,
      userId: user.id,
      username: user.username,
    });
  };

  const columns: ColumnsType<User> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "用户名",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "显示名称",
      dataIndex: "display_name",
      key: "display_name",
      render: (value: string | null) => value || "-",
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={getRoleColor(role)}>{getRoleLabel(role)}</Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "操作",
      key: "actions",
      width: 150,
      render: (_, record) => {
        const canDelete = canDeleteUser(record);
        const canManagePermissions =
          currentUser?.role === "super_admin" &&
          (record.role === "course_admin" || record.role === "proofreader");
        const isCurrentUser = currentUser?.id === record.id;
        const deleting = deleteMutation.isPending && deleteMutation.variables === record.id;

        return (
          <Space>
            {canManagePermissions && (
              <Button
                type="link"
                icon={<SettingOutlined />}
                onClick={() => handleOpenPermissions(record)}
              >
                课程权限
              </Button>
            )}
            {canDelete && !isCurrentUser && (
              <Popconfirm
                title="确认删除该用户？"
                description="此操作不可撤销"
                okText="删除"
                cancelText="取消"
                onConfirm={() => deleteMutation.mutate(record.id)}
                disabled={deleteMutation.isPending && !deleting}
              >
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleting}
                  disabled={deleteMutation.isPending && !deleting}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Drawer
      title="用户管理"
      placement="right"
      width={1000}
      open={open}
      onClose={onClose}
      extra={
        canManageUsers && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            创建用户
          </Button>
        )
      }
    >
      {contextHolder}
      <div>
        {error && (
          <Alert
            type="error"
            message="加载用户列表失败"
            description={(error as Error).message}
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          columns={columns}
          dataSource={data?.users}
          loading={isLoading}
          rowKey="id"
          pagination={{
            total: data?.total,
            showTotal: (total) => `共 ${total} 个用户`,
            showSizeChanger: true,
          }}
        />

        <UserCreateModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />

        <UserPermissionsModal
          open={permissionsModal.open}
          userId={permissionsModal.userId}
          username={permissionsModal.username}
          onClose={() =>
            setPermissionsModal({ open: false, userId: null, username: null })
          }
        />
      </div>
    </Drawer>
  );
}
