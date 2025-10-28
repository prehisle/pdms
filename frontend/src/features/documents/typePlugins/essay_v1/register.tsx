import { Card, Descriptions, Divider, Typography } from "antd";
import type { FC } from "react";
import yaml from "js-yaml";

import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import type { EssayV1DocumentYaml, EssayV1Meta } from "./types";
import { renderNumber } from "../shared";

const { Title, Paragraph } = Typography;

registerYamlPreview("essay_v1", {
  render(content) {
    return renderEssayV1Content(content);
  },
});

function renderEssayV1Content(content: string): YamlPreviewRenderResult {
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

  const parsed: EssayV1DocumentYaml = {
    meta,
    ...body,
  };

  return {
    type: "component",
    node: <EssayV1Preview data={parsed} />,
  };
}

const EssayV1Preview: FC<{ data: EssayV1DocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "论文题"}</Title>
    <Divider />

    {data.meta ? (
      <Card size="small" title="题目元数据" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="ID">{renderNumber(data.meta.id)}</Descriptions.Item>
          <Descriptions.Item label="文档类型">{data.meta.doc_type || "-"}</Descriptions.Item>
          <Descriptions.Item label="数据类型">{data.meta.data_type || "-"}</Descriptions.Item>
          <Descriptions.Item label="来源">
            {Array.isArray(data.meta.source) && data.meta.source.length > 0
              ? data.meta.source.join("，")
              : "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    ) : null}

    {data.content ? (
      <Card size="small" title="题目内容" style={{ marginBottom: 16 }}>
        <div dangerouslySetInnerHTML={{ __html: data.content }} />
      </Card>
    ) : null}

    {data.analysis ? (
      <Card size="small" title="参考解析" style={{ marginBottom: 16 }}>
        <div style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: data.analysis }} />
      </Card>
    ) : null}

    {data.digest ? (
      <Card size="small" title="要点总结" style={{ marginBottom: 16 }}>
        <div style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: data.digest }} />
      </Card>
    ) : null}

    {data.sample ? (
      <Card size="small" title="范文示例" style={{ marginBottom: 16 }}>
        <div style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: data.sample }} />
      </Card>
    ) : null}

    {data.theme_id != null ? (
      <Card size="small" title="主题编号">
        <Paragraph>{renderNumber(data.theme_id)}</Paragraph>
      </Card>
    ) : null}
  </div>
);

function sanitizeMeta(value: unknown): EssayV1Meta | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const meta: EssayV1Meta = {};
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

function sanitizeBody(value: unknown): Omit<EssayV1DocumentYaml, "meta"> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const body: Omit<EssayV1DocumentYaml, "meta"> = {};
  if (isOptionalString(value.title)) {
    body.title = value.title;
  }
  if (isOptionalString(value.content)) {
    body.content = value.content;
  }
  if (isOptionalString(value.analysis)) {
    body.analysis = value.analysis;
  }
  if (isOptionalString(value.digest)) {
    body.digest = value.digest;
  }
  if (isOptionalString(value.sample)) {
    body.sample = value.sample;
  }
  if (typeof value.theme_id === "number") {
    body.theme_id = value.theme_id;
  } else if (typeof value.theme_id === "string" && value.theme_id.trim().length > 0) {
    const parsed = Number(value.theme_id);
    if (!Number.isNaN(parsed)) {
      body.theme_id = parsed;
    }
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
