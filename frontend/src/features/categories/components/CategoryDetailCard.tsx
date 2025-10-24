import { Card, Space, Typography, Tag } from "antd";

import type { Category } from "../../../api/categories";

export interface CategoryDetailCardProps {
  category: Category | null;
}

export function CategoryDetailCard({ category }: CategoryDetailCardProps) {
  if (!category) {
    return (
      <Typography.Paragraph type="secondary">
        目录信息已更新，请重新选择节点查看详情。
      </Typography.Paragraph>
    );
  }
  return (
    <Card style={{ width: "100%" }}>
      <Space direction="vertical">
        <Typography.Text strong>名称</Typography.Text>
        <Space>
          <Typography.Text>{category.name}</Typography.Text>
          {category.deleted_at ? <Tag color="red">已删除</Tag> : null}
        </Space>
        <Typography.Text strong>节点 ID</Typography.Text>
        <Typography.Text code>{category.id}</Typography.Text>
        <Typography.Text strong>路径</Typography.Text>
        <Typography.Text code>{category.path}</Typography.Text>
        <Typography.Text strong>父级 ID</Typography.Text>
        <Typography.Text>{category.parent_id ?? "根目录"}</Typography.Text>
        <Typography.Text strong>排序位置</Typography.Text>
        <Typography.Text>{category.position}</Typography.Text>
        <Typography.Text strong>创建时间</Typography.Text>
        <Typography.Text>
          {new Date(category.created_at).toLocaleString()}
        </Typography.Text>
        <Typography.Text strong>更新时间</Typography.Text>
        <Typography.Text>
          {new Date(category.updated_at).toLocaleString()}
        </Typography.Text>
        {category.deleted_at ? (
          <>
            <Typography.Text strong>删除时间</Typography.Text>
            <Typography.Text>
              {new Date(category.deleted_at).toLocaleString()}
            </Typography.Text>
          </>
        ) : null}
      </Space>
    </Card>
  );
}
