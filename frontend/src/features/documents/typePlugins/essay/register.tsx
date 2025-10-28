import { Card, List, Tag, Typography } from "antd";
import type { FC } from "react";
import yaml from "js-yaml";

import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import type { EssayDocumentYaml, EssayCriterion } from "../../types";
import { renderDifficultyTag, renderNumber, renderTagGroup } from "../shared";

const { Title, Paragraph, Text } = Typography;

registerYamlPreview("essay", {
  render(content) {
    return renderEssayContent(content);
  },
});

function renderEssayContent(content: string): YamlPreviewRenderResult {
  if (!content || !content.trim()) {
    return { type: "empty" };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return { type: "error", message };
  }

  if (!isEssayDocument(parsed)) {
    return { type: "fallback", payload: parsed };
  }

  return {
    type: "component",
    node: <EssayPreview data={parsed} />,
  };
}

const EssayPreview: FC<{ data: EssayDocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "论文题"}</Title>
    <Card size="small" title="论文主题" style={{ marginBottom: 16 }}>
      {data.topic ? <Paragraph strong style={{ fontSize: "16px" }}>{data.topic}</Paragraph> : null}
      {data.description ? (
        <Paragraph style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{data.description}</Paragraph>
      ) : null}
    </Card>

    {data.requirements ? (
      <Card size="small" title="写作要求" style={{ marginBottom: 16 }}>
        <Paragraph style={{ whiteSpace: "pre-wrap" }}>{data.requirements}</Paragraph>
      </Card>
    ) : null}

    {data.word_limit ? (
      <Card size="small" title="字数要求" style={{ marginBottom: 16 }}>
        <Paragraph>
          最少 <Text strong>{renderNumber(data.word_limit.min)}</Text> 字，最多 <Text strong>{renderNumber(data.word_limit.max)}</Text> 字
        </Paragraph>
      </Card>
    ) : null}

    {Array.isArray(data.outline_suggestion) && data.outline_suggestion.length > 0 ? (
      <Card size="small" title="结构建议" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.outline_suggestion}
          renderItem={(item) => (
            <List.Item>
              <Text>{item}</Text>
            </List.Item>
          )}
        />
      </Card>
    ) : null}

    {Array.isArray(data.grading_criteria) && data.grading_criteria.length > 0 ? (
      <Card size="small" title="评分标准" style={{ marginBottom: 16 }}>
        {data.grading_criteria.map((criteria, index) => (
          <EssayCriterionItem key={index} criteria={criteria} />
        ))}
      </Card>
    ) : null}

    {Array.isArray(data.reference_materials) && data.reference_materials.length > 0 ? (
      <Card size="small" title="参考资料" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.reference_materials}
          renderItem={(material) => (
            <List.Item>
              <Text>• {material}</Text>
            </List.Item>
          )}
        />
      </Card>
    ) : null}

    <div style={{ marginTop: 16 }}>
      {renderDifficultyTag(data.difficulty)}
      <Tag color="green" style={{ marginLeft: 8 }}>{renderNumber(data.total_points, "分")}</Tag>
      <Tag color="orange" style={{ marginLeft: 8 }}>{renderNumber(data.time_limit, "分钟")}</Tag>
      {renderTagGroup(data.tags, { inline: true })}
    </div>
  </div>
);

const EssayCriterionItem: FC<{ criteria: EssayCriterion }> = ({ criteria }) => (
  <div style={{ marginBottom: 12 }}>
    <Text strong>{criteria.criterion || "评分项"}</Text>
    {criteria.points != null ? <Tag color="blue" style={{ marginLeft: 8 }}>{criteria.points} 分</Tag> : null}
    {criteria.description ? (
      <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
        {criteria.description}
      </Paragraph>
    ) : null}
  </div>
);

function isEssayDocument(value: unknown): value is EssayDocumentYaml {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;

  if (!isOptionalString(record.title) || !isOptionalString(record.topic) || !isOptionalString(record.description) || !isOptionalString(record.requirements)) {
    return false;
  }
  if (!isOptionalNumber(record.difficulty) || !isOptionalNumber(record.total_points) || !isOptionalNumber(record.time_limit)) {
    return false;
  }
  if (!isOptionalStringArray(record.outline_suggestion) || !isOptionalStringArray(record.reference_materials) || !isOptionalStringArray(record.tags)) {
    return false;
  }
  const wordLimit = record.word_limit;
  if (wordLimit !== undefined) {
    if (!isRecord(wordLimit)) {
      return false;
    }
    if (!isOptionalNumber(wordLimit.min) || !isOptionalNumber(wordLimit.max)) {
      return false;
    }
  }
  const grading = record.grading_criteria;
  if (grading !== undefined) {
    if (!Array.isArray(grading)) {
      return false;
    }
    for (const criterion of grading) {
      if (!isRecord(criterion)) {
        return false;
      }
      if (!isOptionalString(criterion.criterion) || !isOptionalNumber(criterion.points) || !isOptionalString(criterion.description)) {
        return false;
      }
    }
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}
