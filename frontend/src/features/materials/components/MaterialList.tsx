import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Select,
  Input,
  Popconfirm,
  message,
  Card,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  getMaterials,
  deleteMaterial,
  Material,
  MaterialType,
  QuestionType,
} from "../../../api/materials";

const { Search } = Input;

interface MaterialListProps {
  onEdit?: (material: Material) => void;
  onPreview?: (material: Material) => void;
  onCreate?: () => void;
}

const MATERIAL_TYPE_COLORS: Record<MaterialType, string> = {
  question: "blue",
  overview: "green",
  dictation: "orange",
  reference: "purple",
};

const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  question: "题目",
  overview: "概览",
  dictation: "默写",
  reference: "参考资料",
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "单选题",
  multi_choice: "多选题",
  multi_blank_choice: "多空选择题",
  fill_blank: "填空题",
  essay: "问答题",
};

export const MaterialList: React.FC<MaterialListProps> = ({
  onEdit,
  onPreview,
  onCreate,
}) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<
    MaterialType | undefined
  >();
  const [questionTypeFilter, setQuestionTypeFilter] = useState<
    QuestionType | undefined
  >();

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const result = await getMaterials({
        page,
        size: pageSize,
        resource_type: resourceTypeFilter,
        question_type: questionTypeFilter,
      });
      setMaterials(result.items);
      setTotal(result.total);
    } catch (error) {
      message.error(`加载资料失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, [page, pageSize, resourceTypeFilter, questionTypeFilter]);

  const handleDelete = async (id: number) => {
    try {
      await deleteMaterial(id);
      message.success("删除成功");
      loadMaterials();
    } catch (error) {
      message.error(`删除失败: ${error}`);
    }
  };

  const columns: ColumnsType<Material> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
    },
    {
      title: "类型",
      key: "type",
      width: 120,
      render: (_, record) => {
        const type = record.metadata.resource_type;
        return (
          <Tag color={MATERIAL_TYPE_COLORS[type]}>
            {MATERIAL_TYPE_LABELS[type]}
          </Tag>
        );
      },
    },
    {
      title: "题目类型",
      key: "question_type",
      width: 120,
      render: (_, record) => {
        if (
          record.metadata.resource_type === "question" &&
          record.metadata.question_type
        ) {
          return (
            <Tag>{QUESTION_TYPE_LABELS[record.metadata.question_type]}</Tag>
          );
        }
        return "-";
      },
    },
    {
      title: "难度",
      key: "difficulty",
      width: 80,
      render: (_, record) => {
        return record.metadata.difficulty ?? "-";
      },
    },
    {
      title: "标签",
      key: "tags",
      width: 200,
      render: (_, record) => {
        const tags = record.metadata.tags || [];
        if (tags.length === 0) return "-";
        return (
          <Space size={[0, 4]} wrap>
            {tags.map((tag, idx) => (
              <Tag key={idx}>{tag}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
      render: (text) => new Date(text).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          {onPreview && (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onPreview(record)}
            >
              预览
            </Button>
          )}
          {onEdit && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            >
              编辑
            </Button>
          )}
          <Popconfirm
            title="确定删除这个资料吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="资料管理"
      extra={
        onCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            新建资料
          </Button>
        )
      }
    >
      <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
        <Space wrap>
          <Select
            style={{ width: 150 }}
            placeholder="资料类型"
            allowClear
            value={resourceTypeFilter}
            onChange={setResourceTypeFilter}
          >
            <Select.Option value="question">题目</Select.Option>
            <Select.Option value="overview">概览</Select.Option>
            <Select.Option value="dictation">默写</Select.Option>
            <Select.Option value="reference">参考资料</Select.Option>
          </Select>
          {resourceTypeFilter === "question" && (
            <Select
              style={{ width: 150 }}
              placeholder="题目类型"
              allowClear
              value={questionTypeFilter}
              onChange={setQuestionTypeFilter}
            >
              <Select.Option value="single_choice">单选题</Select.Option>
              <Select.Option value="multi_choice">多选题</Select.Option>
              <Select.Option value="multi_blank_choice">
                多空选择题
              </Select.Option>
              <Select.Option value="fill_blank">填空题</Select.Option>
              <Select.Option value="essay">问答题</Select.Option>
            </Select>
          )}
        </Space>
      </Space>

      <Table
        columns={columns}
        dataSource={materials}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 1200 }}
      />
    </Card>
  );
};
