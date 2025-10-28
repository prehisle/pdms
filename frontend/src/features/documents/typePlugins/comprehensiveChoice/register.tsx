import { Card, Divider, List, Tag, Typography } from "antd";
import type { FC } from "react";
import yaml from "js-yaml";

import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import type { ComprehensiveChoiceDocumentYaml, ComprehensiveChoiceBlank } from "./types";
import { renderDifficultyTag, renderNumber, renderTagGroup } from "../shared";

const { Title, Paragraph, Text } = Typography;

registerYamlPreview("comprehensive_choice", {
  render(content) {
    return renderComprehensiveChoiceContent(content);
  },
});

function renderComprehensiveChoiceContent(content: string): YamlPreviewRenderResult {
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

  if (!isComprehensiveChoiceDocument(parsed)) {
    return { type: "fallback", payload: parsed };
  }

  return {
    type: "component",
    node: <ComprehensiveChoicePreview data={parsed} />,
  };
}

const ComprehensiveChoicePreview: FC<{ data: ComprehensiveChoiceDocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "综合选择题"}</Title>
    <Divider />

    {data.description ? (
      <Card size="small" title="题目描述" style={{ marginBottom: 16 }}>
        <Paragraph>{data.description}</Paragraph>
      </Card>
    ) : null}

    {data.stem ? (
      <Card size="small" title="题干" style={{ marginBottom: 16 }}>
        <Paragraph strong style={{ fontSize: "16px" }}>{data.stem}</Paragraph>
      </Card>
    ) : null}

    {Array.isArray(data.blanks) && data.blanks.length > 0
      ? data.blanks.map((blank, index) => (
          <Card key={index} size="small" title={renderBlankTitle(blank)} style={{ marginBottom: 16 }}>
            {blank.question ? <Paragraph strong>{blank.question}</Paragraph> : null}
            {Array.isArray(blank.options) ? (
              <List
                size="small"
                dataSource={blank.options}
                renderItem={(option) => (
                  <List.Item
                    style={{
                      background: option.is_correct ? "#f6ffed" : "transparent",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      marginBottom: "4px",
                    }}
                  >
                    <Text strong={Boolean(option.is_correct)}>
                      {option.id ? `${option.id}. ` : ""}
                      {option.content ?? "选项"}
                      {option.is_correct ? <Tag color="success" style={{ marginLeft: 8 }}>正确答案</Tag> : null}
                    </Text>
                  </List.Item>
                )}
              />
            ) : null}
          </Card>
        ))
      : null}

    <Card size="small" title="正确答案" style={{ marginBottom: 16 }}>
      <Paragraph code strong style={{ fontSize: "16px" }}>{data.correct_answer || "未提供"}</Paragraph>
    </Card>

    {data.explanation ? (
      <Card size="small" title="解析">
        <Paragraph style={{ whiteSpace: "pre-wrap" }}>{data.explanation}</Paragraph>
      </Card>
    ) : null}

    <div style={{ marginTop: 16 }}>
      {renderDifficultyTag(data.difficulty)}
      <Tag color="green" style={{ marginLeft: 8 }}>{renderNumber(data.points, "分")}</Tag>
      {renderTagGroup(data.tags, { inline: true })}
    </div>
  </div>
);

function renderBlankTitle(blank: ComprehensiveChoiceBlank): string {
  if (blank.blank_id != null) {
    return `第 ${blank.blank_id} 空`;
  }
  return "空位";
}

function isComprehensiveChoiceDocument(value: unknown): value is ComprehensiveChoiceDocumentYaml {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;

  if (!isOptionalString(record.title) || !isOptionalString(record.description) || !isOptionalString(record.stem)) {
    return false;
  }
  if (!isOptionalString(record.correct_answer) || !isOptionalString(record.explanation)) {
    return false;
  }
  if (!isOptionalNumber(record.difficulty) || !isOptionalNumber(record.points)) {
    return false;
  }
  if (!isOptionalStringArray(record.tags)) {
    return false;
  }
  const blanks = record.blanks;
  if (blanks !== undefined) {
    if (!Array.isArray(blanks)) {
      return false;
    }
    for (const blank of blanks) {
      if (!isRecord(blank)) {
        return false;
      }
      if (!isOptionalNumber(blank.blank_id) || !isOptionalNumber(blank.position)) {
        return false;
      }
      if (!isOptionalString(blank.question)) {
        return false;
      }
      const options = blank.options;
      if (options !== undefined) {
        if (!Array.isArray(options)) {
          return false;
        }
        for (const option of options) {
          if (!isRecord(option)) {
            return false;
          }
          if (!isOptionalString(option.id) || !isOptionalString(option.content)) {
            return false;
          }
          if (!isOptionalBoolean(option.is_correct)) {
            return false;
          }
        }
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

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}
