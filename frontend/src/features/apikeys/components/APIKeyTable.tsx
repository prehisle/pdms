import { Table, Space, Button, Popconfirm, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  EditOutlined,
  DeleteOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import type { APIKey } from "../../../api/apikeys";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

const { Text } = Typography;

interface APIKeyTableProps {
  dataSource: APIKey[];
  loading: boolean;
  isSuperAdmin: boolean;
  onEdit: (key: APIKey) => void;
  onRevoke: (keyId: number) => void;
  onDelete: (keyId: number) => void;
}

export function APIKeyTable({
  dataSource,
  loading,
  isSuperAdmin,
  onEdit,
  onRevoke,
  onDelete,
}: APIKeyTableProps) {
  const getStatusTag = (key: APIKey) => {
    if (key.deleted_at) {
      return <Tag color="default">已撤销</Tag>;
    }
    if (key.expires_at && dayjs(key.expires_at).isBefore(dayjs())) {
      return <Tag color="red">已过期</Tag>;
    }
    return <Tag color="green">活跃</Tag>;
  };

  const columns: ColumnsType<APIKey> = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 200,
      ellipsis: true,
      render: (name: string) => (
        <Tooltip title={name}>
          <Text strong>{name}</Text>
        </Tooltip>
      ),
    },
    {
      title: "密钥前缀",
      dataIndex: "key_prefix",
      key: "key_prefix",
      width: 180,
      render: (prefix: string) => <Text code>{prefix}</Text>,
    },
    {
      title: "状态",
      key: "status",
      width: 100,
      render: (_, record) => getStatusTag(record),
    },
    {
      title: "关联用户",
      key: "user",
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.user?.username || `ID: ${record.user_id}`}</Text>
          {record.user?.role && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.user.role === "super_admin"
                ? "超级管理员"
                : record.user.role === "course_admin"
                  ? "课程管理员"
                  : "校对员"}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "过期时间",
      dataIndex: "expires_at",
      key: "expires_at",
      width: 150,
      render: (expiresAt: string | undefined) =>
        expiresAt ? (
          <Tooltip title={dayjs(expiresAt).format("YYYY-MM-DD HH:mm:ss")}>
            <Space>
              <ClockCircleOutlined />
              <Text>{dayjs(expiresAt).fromNow()}</Text>
            </Space>
          </Tooltip>
        ) : (
          <Text type="secondary">永不过期</Text>
        ),
    },
    {
      title: "最后使用",
      dataIndex: "last_used_at",
      key: "last_used_at",
      width: 150,
      render: (lastUsedAt: string | undefined) =>
        lastUsedAt ? (
          <Tooltip title={dayjs(lastUsedAt).format("YYYY-MM-DD HH:mm:ss")}>
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text>{dayjs(lastUsedAt).fromNow()}</Text>
            </Space>
          </Tooltip>
        ) : (
          <Text type="secondary">从未使用</Text>
        ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (createdAt: string) => (
        <Tooltip title={dayjs(createdAt).format("YYYY-MM-DD HH:mm:ss")}>
          <Text>{dayjs(createdAt).fromNow()}</Text>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 180,
      fixed: "right" as const,
      render: (_, record) => {
        const isRevoked = !!record.deleted_at;

        return (
          <Space size="small">
            <Tooltip title="编辑名称">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(record)}
                disabled={isRevoked}
              >
                编辑
              </Button>
            </Tooltip>

            {!isRevoked && (
              <Popconfirm
                title="撤销 API Key"
                description="撤销后此 API Key 将立即失效，确定要撤销吗？"
                onConfirm={() => onRevoke(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  icon={<StopOutlined />}
                  danger
                >
                  撤销
                </Button>
              </Popconfirm>
            )}

            {isSuperAdmin && (
              <Popconfirm
                title="永久删除"
                description="永久删除后无法恢复，确定要删除吗？"
                onConfirm={() => onDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
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
    <Table
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      rowKey="id"
      scroll={{ x: 1400 }}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`,
      }}
    />
  );
}
