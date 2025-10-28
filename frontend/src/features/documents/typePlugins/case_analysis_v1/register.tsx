import { Card, Descriptions, Divider, List, Tag, Typography } from "antd";
import type { FC } from "react";
import yaml from "js-yaml";

import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import type {
  CaseAnalysisV1Detail,
  CaseAnalysisV1DocumentYaml,
  CaseAnalysisV1Meta,
} from "../../types";
import { renderNumber } from "../shared";

const { Title, Paragraph, Text } = Typography;

registerYamlPreview("case_analysis_v1", {
  render(content) {
    return renderCaseAnalysisV1Content(content);
  },
});

function renderCaseAnalysisV1Content(content: string): YamlPreviewRenderResult {
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
  const data = sanitizeBody(bodyDoc);

  if (!meta && !data) {
    return { type: "fallback", payload: docs.length === 1 ? docs[0] : docs };
  }

  const parsed: CaseAnalysisV1DocumentYaml = {
    meta,
    ...data,
  };

  return {
    type: "component",
    node: <CaseAnalysisV1Preview data={parsed} />,
  };
}

const CaseAnalysisV1Preview: FC<{ data: CaseAnalysisV1DocumentYaml }> = ({ data }) => {
  const details = Array.isArray(data.details) ? data.details : [];

  return (
    <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
      <Title level={3}>{stripHtml(data.title) || "案例分析题"}</Title>
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

      {data.title ? (
        <Card size="small" title="案例题干" style={{ marginBottom: 16 }}>
          <div dangerouslySetInnerHTML={{ __html: data.title }} />
        </Card>
      ) : null}

      {data.analysis ? (
        <Card size="small" title="解析" style={{ marginBottom: 16 }}>
          <div style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: data.analysis }} />
        </Card>
      ) : null}

      {details.length > 0 ? (
        <Card size="small" title="小问列表" style={{ marginBottom: 16 }}>
          <List
            dataSource={details}
            renderItem={(item) => <CaseAnalysisV1DetailItem detail={item} />}
          />
        </Card>
      ) : null}
    </div>
  );
};

const CaseAnalysisV1DetailItem: FC<{ detail: CaseAnalysisV1Detail }> = ({ detail }) => (
  <List.Item style={{ flexDirection: "column", alignItems: "flex-start" }}>
    <div style={{ width: "100%" }}>
      <Text strong>
        {detail.no != null ? `问题 ${detail.no}` : "问题"}
        {detail.score != null ? <Tag color="blue" style={{ marginLeft: 8 }}>{detail.score} 分</Tag> : null}
        {detail.type ? <Tag color="default" style={{ marginLeft: 8 }}>{detail.type}</Tag> : null}
      </Text>
    </div>
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

function sanitizeMeta(value: unknown): CaseAnalysisV1Meta | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const meta: CaseAnalysisV1Meta = {};
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

function sanitizeBody(value: unknown): Omit<CaseAnalysisV1DocumentYaml, "meta"> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const body: Omit<CaseAnalysisV1DocumentYaml, "meta"> = {};
  if (isOptionalString(value.title)) {
    body.title = value.title;
  }
  if (isOptionalString(value.analysis)) {
    body.analysis = value.analysis;
  }
  const details = sanitizeDetails(value.details);
  if (details) {
    body.details = details;
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

function sanitizeDetails(value: unknown): CaseAnalysisV1Detail[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const details = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const detail: CaseAnalysisV1Detail = {};
      if (typeof item.no === "number" || typeof item.no === "string") {
        detail.no = item.no;
      }
      if (isOptionalString(item.question)) {
        detail.question = item.question;
      }
      if (isOptionalString(item.answer)) {
        detail.answer = item.answer;
      }
      if (typeof item.score === "number") {
        detail.score = item.score;
      } else if (typeof item.score === "string" && item.score.trim().length > 0) {
        const parsed = Number(item.score);
        if (!Number.isNaN(parsed)) {
          detail.score = parsed;
        }
      }
      if (isOptionalString(item.type)) {
        detail.type = item.type;
      }
      return Object.keys(detail).length > 0 ? detail : null;
    })
    .filter((entry): entry is CaseAnalysisV1Detail => entry !== null);
  return details.length > 0 ? details : undefined;
}

function stripHtml(value?: string): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/<[^>]+>/g, "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
