import React from "react";
import { Modal, Descriptions, Tag, Space, Typography, Divider, Card } from "antd";
import {
  Material,
  MaterialType,
  QuestionType,
} from "../../../api/materials";

const { Paragraph, Text, Title } = Typography;

interface MaterialPreviewProps {
  visible: boolean;
  material?: Material | null;
  onClose?: () => void;
}

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

export const MaterialPreview: React.FC<MaterialPreviewProps> = ({
  visible,
  material,
  onClose,
}) => {
  if (!material) return null;

  const renderQuestionContent = () => {
    if (material.metadata.resource_type !== "question") return null;

    const { question_type, difficulty, options, blanks, answer, analysis } =
      material.metadata;

    return (
      <>
        <Divider />
        <Title level={5}>题目详情</Title>

        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="题目类型">
            {question_type ? QUESTION_TYPE_LABELS[question_type] : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="难度">
            {difficulty ? `${difficulty} 星` : "-"}
          </Descriptions.Item>
        </Descriptions>

        {options && options.length > 0 && (
          <Card title="选项" size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              {options.map((opt, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <Tag color={opt.is_correct ? "green" : "default"}>
                    {opt.label}
                  </Tag>
                  <Text>{opt.content}</Text>
                  {opt.is_correct && <Tag color="green" style={{ marginLeft: 8 }}>正确答案</Tag>}
                </div>
              ))}
            </Space>
          </Card>
        )}

        {blanks && blanks.length > 0 && (
          <Card title="填空配置" size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              {blanks.map((blank, idx) => (
                <div key={idx}>
                  <Text strong>空格 {blank.index}：</Text>
                  <Space style={{ marginLeft: 8 }}>
                    {blank.acceptable_answers.map((ans, i) => (
                      <Tag key={i}>{ans}</Tag>
                    ))}
                  </Space>
                </div>
              ))}
            </Space>
          </Card>
        )}

        {answer && (
          <Card title="答案" size="small" style={{ marginTop: 16 }}>
            <Paragraph>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {typeof answer === "string" ? answer : JSON.stringify(answer, null, 2)}
              </pre>
            </Paragraph>
          </Card>
        )}

        {analysis && (
          <Card title="解析" size="small" style={{ marginTop: 16 }}>
            <Paragraph>{analysis}</Paragraph>
          </Card>
        )}
      </>
    );
  };

  return (
    <Modal
      title="资料预览"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Title level={4}>{material.title}</Title>

      <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }}>
        <Descriptions.Item label="ID">{material.id}</Descriptions.Item>
        <Descriptions.Item label="资料类型">
          {MATERIAL_TYPE_LABELS[material.metadata.resource_type]}
        </Descriptions.Item>
        <Descriptions.Item label="创建人">
          {material.created_by}
        </Descriptions.Item>
        <Descriptions.Item label="更新人">
          {material.updated_by}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {new Date(material.created_at).toLocaleString("zh-CN")}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {new Date(material.updated_at).toLocaleString("zh-CN")}
        </Descriptions.Item>
      </Descriptions>

      {material.metadata.tags && material.metadata.tags.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong>标签：</Text>
          <Space style={{ marginLeft: 8 }}>
            {material.metadata.tags.map((tag, idx) => (
              <Tag key={idx}>{tag}</Tag>
            ))}
          </Space>
        </div>
      )}

      {renderQuestionContent()}
    </Modal>
  );
};
