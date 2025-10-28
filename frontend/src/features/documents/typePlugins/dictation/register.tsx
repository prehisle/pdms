import { Card, Descriptions, List, Typography } from "antd";
import type { FC } from "react";
import yaml from "js-yaml";

import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import type { DictationDocumentYaml } from "./types";
import { renderDifficultyTag, renderNumber, renderTagGroup } from "../shared";

const { Title, Paragraph, Text } = Typography;

registerYamlPreview("dictation", {
  render(content) {
    return renderDictationContent(content);
  },
});

function renderDictationContent(content: string): YamlPreviewRenderResult {
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

    if (!isDictationDocument(parsed)) {
      return { type: "fallback", payload: parsed };
    }

    return {
      type: "component",
      node: <DictationPreview data={parsed} />,
    };
}

const DictationPreview: FC<{ data: DictationDocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "默写题"}</Title>
    <Card size="small" title="题目信息" style={{ marginBottom: 16 }}>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="类型">{renderDictationType(data.type)}</Descriptions.Item>
        <Descriptions.Item label="难度">{renderDifficultyTag(data.difficulty)}</Descriptions.Item>
        <Descriptions.Item label="分值">{renderNumber(data.points, "分")}</Descriptions.Item>
        <Descriptions.Item label="时限">{renderNumber(data.time_limit, "秒")}</Descriptions.Item>
      </Descriptions>
    </Card>

    <Card size="small" title="默写内容" style={{ marginBottom: 16 }}>
      <Paragraph strong>{data.content?.text || "暂无正文"}</Paragraph>
      {data.content?.pinyin ? <Paragraph type="secondary">拼音/音标：{data.content.pinyin}</Paragraph> : null}
    </Card>

    {Array.isArray(data.hints) && data.hints.length > 0 ? (
      <Card size="small" title="提示" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.hints}
          renderItem={(hint, index) => (
            <List.Item>
              <Text>
                提示 {index + 1}：{hint}
              </Text>
            </List.Item>
          )}
        />
      </Card>
    ) : null}

    <Card size="small" title="标准答案">
      <Paragraph code>{data.answer_key || "暂无答案"}</Paragraph>
    </Card>

    {renderTagGroup(data.tags)}
  </div>
);

function renderDictationType(value: string | undefined): string {
  switch (value) {
    case "word":
      return "单词";
    case "phrase":
      return "短语";
    case "sentence":
      return "句子";
    case "paragraph":
      return "段落";
    default:
      return value || "-";
  }
}

function isDictationDocument(value: unknown): value is DictationDocumentYaml {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;

  if (!isOptionalString(record.title) || !isOptionalString(record.type)) {
    return false;
  }
  if (!isOptionalNumber(record.difficulty) || !isOptionalNumber(record.points) || !isOptionalNumber(record.time_limit)) {
    return false;
  }
  if (!isOptionalString(record.answer_key)) {
    return false;
  }
  if (!isOptionalStringArray(record.hints) || !isOptionalStringArray(record.tags)) {
    return false;
  }
  const content = record.content;
  if (content !== undefined) {
    if (!isRecord(content)) {
      return false;
    }
    if (!isOptionalString(content.text) || !isOptionalString(content.pinyin)) {
      return false;
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
