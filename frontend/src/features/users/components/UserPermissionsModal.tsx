import { useState, useEffect } from "react";
import { Modal, Transfer, message, Spin, Alert, Space, Typography } from "antd";
import type { TransferProps } from "antd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserCourses,
  grantCoursePermission,
  revokeCoursePermission,
} from "../../../api/users";
import { getCategoryTree, type Category } from "../../../api/categories";

interface UserPermissionsModalProps {
  open: boolean;
  userId: number | null;
  username: string | null;
  onClose: () => void;
}

interface CourseItem {
  key: string;
  title: string;
  description?: string;
}

export function UserPermissionsModal({
  open,
  userId,
  username,
  onClose,
}: UserPermissionsModalProps) {
  const queryClient = useQueryClient();
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 获取所有根节点（课程）
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories-tree"],
    queryFn: () => getCategoryTree(),
    enabled: open,
  });

  // 获取用户当前的课程权限
  const {
    data: userCourses,
    isLoading: userCoursesLoading,
    error: userCoursesError,
  } = useQuery({
    queryKey: ["user-courses", userId],
    queryFn: () => (userId ? getUserCourses(userId) : Promise.resolve({ course_ids: [] })),
    enabled: open && userId !== null,
  });

  const grantMutation = useMutation({
    mutationFn: ({ userId, rootNodeId }: { userId: number; rootNodeId: number }) =>
      grantCoursePermission(userId, rootNodeId),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ userId, rootNodeId }: { userId: number; rootNodeId: number }) =>
      revokeCoursePermission(userId, rootNodeId),
  });

  // 从分类树中提取根节点
  // getCategoryTree 返回的是树形结构，第一层就是根节点
  // 根节点的特征是没有 parent_id 字段（而不是 parent_id === null）
  const rootNodes: Category[] = (categories || []).filter(
    (cat) => cat.parent_id === null || cat.parent_id === undefined
  );

  // 构建 Transfer 数据源
  const dataSource: CourseItem[] = rootNodes.map((node) => ({
    key: String(node.id),
    title: node.name,
    description: node.path,
  }));

  // 当 modal 打开或 userId 变化时，重置状态
  useEffect(() => {
    if (!open || userId === null) {
      setTargetKeys([]);
      return;
    }

    // 当用户课程数据加载完成时，设置选中的课程
    if (userCourses?.course_ids) {
      setTargetKeys(userCourses.course_ids.map(String));
    } else {
      setTargetKeys([]);
    }
  }, [userCourses, userId, open]);

  const handleChange: TransferProps["onChange"] = (nextTargetKeys) => {
    setTargetKeys(nextTargetKeys.map(String));
  };

  const handleSave = async () => {
    if (userId === null) {
      return;
    }

    setSaving(true);
    try {
      const currentCourseIds = new Set(userCourses?.course_ids || []);
      const nextCourseIds = new Set(targetKeys.map(Number));

      // 需要授予的权限
      const toGrant = Array.from(nextCourseIds).filter(
        (id) => !currentCourseIds.has(id),
      );
      // 需要撤销的权限
      const toRevoke = Array.from(currentCourseIds).filter(
        (id) => !nextCourseIds.has(id),
      );

      // 执行授予操作
      for (const rootNodeId of toGrant) {
        await grantMutation.mutateAsync({ userId, rootNodeId });
      }

      // 执行撤销操作
      for (const rootNodeId of toRevoke) {
        await revokeMutation.mutateAsync({ userId, rootNodeId });
      }

      message.success("课程权限已更新");
      await queryClient.invalidateQueries({ queryKey: ["user-courses", userId] });
      onClose();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "更新课程权限失败",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // 重置为初始状态
    if (userCourses?.course_ids) {
      setTargetKeys(userCourses.course_ids.map(String));
    } else {
      setTargetKeys([]);
    }
    onClose();
  };

  const isLoading = categoriesLoading || userCoursesLoading;

  return (
    <Modal
      title={`管理课程权限 - ${username || ""}`}
      open={open}
      onOk={handleSave}
      onCancel={handleCancel}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      width={700}
      destroyOnHidden
      maskClosable={!saving}
      keyboard={!saving}
      okButtonProps={{ disabled: dataSource.length === 0 }}
    >
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Space direction="vertical" align="center" size="middle">
            <Spin size="large" />
            <Typography.Text type="secondary">加载中...</Typography.Text>
          </Space>
        </div>
      ) : userCoursesError ? (
        <Alert
          type="error"
          message="加载失败"
          description={(userCoursesError as Error).message}
        />
      ) : dataSource.length === 0 ? (
        <Alert
          type="info"
          message="暂无可用课程"
          description="系统中还没有创建任何根目录（课程）。请先在主页面创建根目录后再分配权限。"
          showIcon
        />
      ) : (
        <>
          <p style={{ marginBottom: 16, color: "#666" }}>
            选择该用户可以访问的课程（根目录）。用户只能查看和管理被授权的课程及其子节点。
          </p>
          <Transfer
            dataSource={dataSource}
            titles={["可用课程", "已授权课程"]}
            targetKeys={targetKeys}
            onChange={handleChange}
            render={(item) => (
              <div>
                <div style={{ fontWeight: 500 }}>{item.title}</div>
                {item.description && (
                  <div style={{ fontSize: 12, color: "#999" }}>
                    {item.description}
                  </div>
                )}
              </div>
            )}
            listStyle={{
              width: 300,
              height: 400,
            }}
            locale={{
              itemUnit: "项",
              itemsUnit: "项",
              searchPlaceholder: "搜索课程",
              notFoundContent: "无数据",
            }}
            showSearch
            filterOption={(inputValue, item) =>
              item.title.toLowerCase().includes(inputValue.toLowerCase())
            }
          />
        </>
      )}
    </Modal>
  );
}
