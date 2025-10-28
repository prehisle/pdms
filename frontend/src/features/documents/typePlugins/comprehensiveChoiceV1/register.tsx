import { Card, Descriptions, Divider, List, Tag, Typography } from "antd";
import type { FC } from "react";
import yaml from "js-yaml";

import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import type {
  ComprehensiveChoiceV1DocumentYaml,
  ComprehensiveChoiceV1Meta,
  ComprehensiveChoiceV1Option,
  ComprehensiveChoiceV1SubQuestion,
} from "./types";
import { renderNumber, stripHtmlTags } from "../shared";

const { Title, Paragraph, Text } = Typography;

registerYamlPreview("comprehensive_choice_v1", {
  render(content) {
    return renderComprehensiveChoiceV1Content(content);
  },
});

function renderComprehensiveChoiceV1Content(content: string): YamlPreviewRenderResult {
  if (!content || !content.trim()) {
    return { type: "empty" };
  }

  let docs: unknown[];
  try {
    docs = yaml.loadAll(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return { type: "error", message };
  }

  if (docs.length === 0) {
    return { type: "empty" };
  }

  const [metaDoc, bodyDoc] = docs.length > 1 ? [docs[0], docs[1]] : [undefined, docs[0]];
  const meta = sanitizeMeta(metaDoc);
  const body = sanitizeBody(bodyDoc);

  if (!meta && !body) {
    return { type: "fallback", payload: docs.length === 1 ? docs[0] : docs };
  }

  return {
    type: "component",
    node: <ComprehensiveChoiceV1Preview data={{ meta, body }} />,
  };
}

const ComprehensiveChoiceV1Preview: FC<{ data: ComprehensiveChoiceV1DocumentYaml }> = ({ data }) => {
  const meta = data.meta;
  const body = data.body;
  const subQuestions = body && Array.isArray(body.sub_questions) ? body.sub_questions : [];

  return (
    <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
      <Title level={3}>{stripHtmlTags(body?.title) || "综合知识选择题"}</Title>
      <Divider />

      {meta ? (
        <Card size="small" title="题目元数据" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="ID">{renderNumber(meta.id)}</Descriptions.Item>
            <Descriptions.Item label="文档类型">{meta.doc_type || "-"}</Descriptions.Item>
            <Descriptions.Item label="数据类型">{meta.data_type || "-"}</Descriptions.Item>
            <Descriptions.Item label="来源">
              {Array.isArray(meta.source) && meta.source.length > 0 ? meta.source.join("，") : "-"}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ) : null}

      {body?.title ? (
        <Card size="small" title="题干" style={{ marginBottom: 16 }}>
          <div dangerouslySetInnerHTML={{ __html: body.title }} />
        </Card>
      ) : null}

      {Array.isArray(subQuestions) && subQuestions.length > 0 ? (
        <Card size="small" title="小题" style={{ marginBottom: 16 }}>
          <List
            dataSource={subQuestions}
            renderItem={(item, index) => (
              <List.Item style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <Text strong>小题 {index + 1}</Text>
                {Array.isArray(item.options) ? (
                  <List
                    size="small"
                    dataSource={item.options}
                    renderItem={(option) => (
                      <List.Item style={{ padding: "4px 0" }}>
                        <Text>
                          {option.key ? `${option.key}. ` : ""}
                          {option.content || "选项"}
                          {item.answer === option.key ? <Tag color="success" style={{ marginLeft: 8 }}>正确</Tag> : null}
                        </Text>
                      </List.Item>
                    )}
                  />
                ) : null}
                {item.answer ? (
                  <Paragraph code style={{ marginTop: 8 }}>正确答案：{item.answer}</Paragraph>
                ) : null}
              </List.Item>
            )}
          />
        </Card>
      ) : null}

      {body?.analysis ? (
        <Card size="small" title="解析">
          <div style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: body.analysis }} />
        </Card>
      ) : null}
    </div>
  );
};

function sanitizeMeta(value: unknown): ComprehensiveChoiceV1Meta | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const meta: ComprehensiveChoiceV1Meta = {};
  if (typeof value.id === "number") {
    meta.id = value.id;
  } else if (typeof value.id === "string" && value.id.trim().length > 0) {
    const parsed = Number(value.id);
    if (!Number.isNaN(parsed)) {
      meta.id = parsed;
    }
  }
  if (isOptionalString(value.doc_type)) {
    meta.doc_type = value.doc_type;
  }
  if (isOptionalString(value.data_type)) {
    meta.data_type = value.data_type;
  }
  if (Array.isArray(value.source)) {
    const normalized = value.source
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item == null) {
          return null;
        }
        try {
          return String(item);
        } catch {
          return null;
        }
      })
      .filter((item): item is string => Boolean(item && item.trim().length > 0));
    if (normalized.length > 0) {
      meta.source = normalized;
    }
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}

function sanitizeBody(value: unknown): ComprehensiveChoiceV1DocumentYaml["body"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const body: ComprehensiveChoiceV1DocumentYaml["body"] = {};
  if (isOptionalString(value.title)) {
    body.title = value.title;
  }
  if (isOptionalString(value.analysis)) {
    body.analysis = value.analysis;
  }
  const subQuestions = sanitizeSubQuestions(value.sub_questions);
  if (subQuestions) {
    body.sub_questions = subQuestions;
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

function sanitizeSubQuestions(value: unknown): ComprehensiveChoiceV1SubQuestion[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const subQuestion: ComprehensiveChoiceV1SubQuestion = {};
      const options = sanitizeOptions(item.options);
      if (options) {
        subQuestion.options = options;
      }
      if (isOptionalString(item.answer)) {
        subQuestion.answer = item.answer;
      }
      return Object.keys(subQuestion).length > 0 ? subQuestion : null;
    })
    .filter((entry): entry is ComprehensiveChoiceV1SubQuestion => entry !== null);
  return result.length > 0 ? result : undefined;
}

function sanitizeOptions(value: unknown): ComprehensiveChoiceV1Option[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const options = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const option: ComprehensiveChoiceV1Option = {};
      if (isOptionalString(item.key)) {
        option.key = item.key;
      }
      if (isOptionalString(item.content)) {
        option.content = item.content;
      }
      return Object.keys(option).length > 0 ? option : null;
    })
    .filter((entry): entry is ComprehensiveChoiceV1Option => entry !== null);
  return options.length > 0 ? options : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
