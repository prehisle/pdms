import { Card, Descriptions, Divider, List, Typography } from "antd";
import type { FC } from "react";
import yaml from "js-yaml";

import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import type { DictationV1Detail, DictationV1DocumentYaml, DictationV1Meta } from "./types";
import { renderNumber } from "../shared";

const { Title, Paragraph, Text } = Typography;

registerYamlPreview("dictation_v1", {
  render(content) {
    return renderDictationV1Content(content);
  },
});

function renderDictationV1Content(content: string): YamlPreviewRenderResult {
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

  const parsed: DictationV1DocumentYaml = {
    meta,
    ...body,
  };

  return {
    type: "component",
    node: <DictationV1Preview data={parsed} />,
  };
}

const DictationV1Preview: FC<{ data: DictationV1DocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.meta?.question_type || "默写题"}</Title>
    <Divider />

    {data.meta ? (
      <Card size="small" title="题目元数据" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="ID">{renderNumber(data.meta.id)}</Descriptions.Item>
          <Descriptions.Item label="文档类型">{data.meta.doc_type || "-"}</Descriptions.Item>
          <Descriptions.Item label="题型">{data.meta.question_type || "-"}</Descriptions.Item>
          <Descriptions.Item label="来源">
            {Array.isArray(data.meta.source) && data.meta.source.length > 0
              ? data.meta.source.join("，")
              : "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    ) : null}

    {Array.isArray(data.details) && data.details.length > 0 ? (
      <Card size="small" title="题目列表">
        <List dataSource={data.details} renderItem={(item) => <DictationV1DetailItem detail={item} />} />
      </Card>
    ) : null}
  </div>
);

const DictationV1DetailItem: FC<{ detail: DictationV1Detail }> = ({ detail }) => (
  <List.Item style={{ flexDirection: "column", alignItems: "flex-start" }}>
    <Text strong>
      {detail.no != null ? `小题 ${detail.no}` : "小题"}
      {detail.type ? <span style={{ marginLeft: 8 }}>（{detail.type}）</span> : null}
      {detail.km_point ? <span style={{ marginLeft: 8, color: "#888" }}>知识点：{detail.km_point}</span> : null}
    </Text>
    {detail.question ? (
      <Paragraph style={{ marginTop: 8 }}>
        <span dangerouslySetInnerHTML={{ __html: detail.question }} />
      </Paragraph>
    ) : null}
    {detail.answer ? (
      <Paragraph style={{ whiteSpace: "pre-wrap", background: "#fafafa", padding: "12px", borderRadius: "4px" }}>
        <span dangerouslySetInnerHTML={{ __html: detail.answer }} />
      </Paragraph>
    ) : null}
  </List.Item>
);

function sanitizeMeta(value: unknown): DictationV1Meta | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const meta: DictationV1Meta = {};
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
  if (isOptionalString(value.question_type)) {
    meta.question_type = value.question_type;
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

function sanitizeBody(value: unknown): Omit<DictationV1DocumentYaml, "meta"> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const body: Omit<DictationV1DocumentYaml, "meta"> = {};
  const details = sanitizeDetails(value.details);
  if (details) {
    body.details = details;
  }
  // study_time 可直接透传，保持兼容
  if (value.study_time !== undefined) {
    body.study_time = value.study_time;
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

function sanitizeDetails(value: unknown): DictationV1Detail[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const details = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const detail: DictationV1Detail = {};
      if (typeof item.no === "number" || typeof item.no === "string") {
        detail.no = item.no;
      }
      if (isOptionalString(item.question)) {
        detail.question = item.question;
      }
      if (isOptionalString(item.answer)) {
        detail.answer = item.answer;
      }
      if (isOptionalString(item.type)) {
        detail.type = item.type;
      }
      if (isOptionalString(item.km_point)) {
        detail.km_point = item.km_point;
      }
      return Object.keys(detail).length > 0 ? detail : null;
    })
    .filter((entry): entry is DictationV1Detail => entry !== null);
  return details.length > 0 ? details : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
