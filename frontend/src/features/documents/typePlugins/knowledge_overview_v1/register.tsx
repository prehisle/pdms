import { Card, Descriptions, Divider, Space, Typography } from "antd";
import type { FC } from "react";

import { HTMLPreview } from "../../components/HTMLPreview";
import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import { parseFrontMatterHtml, renderNumber } from "../shared";
import { OverviewThemeStyles, useOverviewTheme } from "../overviewThemes";
import type { KnowledgeOverviewV1DocumentHtml, KnowledgeOverviewV1Meta } from "./types";
import "../overviewStyles.css";

const { Title } = Typography;

registerYamlPreview("knowledge_overview_v1", {
  render(content) {
    return renderKnowledgeOverviewV1Content(content);
  },
});

function renderKnowledgeOverviewV1Content(content: string): YamlPreviewRenderResult {
  if (!content || !content.trim()) {
    return { type: "empty" };
  }

  const { meta, body } = parseFrontMatterHtml(content);
  const document: KnowledgeOverviewV1DocumentHtml = {
    meta: sanitizeMeta(meta),
    body,
  };

  if (!document.meta && !document.body.trim()) {
    return { type: "fallback", payload: content };
  }

  return {
    type: "component",
    node: <KnowledgeOverviewV1Preview data={document} />,
  };
}

const KnowledgeOverviewV1Preview: FC<{ data: KnowledgeOverviewV1DocumentHtml }> = ({ data }) => {
  const { theme, selector } = useOverviewTheme();

  return (
    <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
      <Space align="baseline" style={{ display: "flex", justifyContent: "space-between" }}>
        <Title level={3} style={{ marginBottom: 8 }}>
          知识点概览
        </Title>
        {selector}
      </Space>
      <Divider />

      {data.meta ? (
        <Card size="small" title="元数据" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="ID">{renderNumber(data.meta.id)}</Descriptions.Item>
            <Descriptions.Item label="文档类型">{data.meta.doc_type || "-"}</Descriptions.Item>
            <Descriptions.Item label="数据类型">{data.meta.data_type || "-"}</Descriptions.Item>
          </Descriptions>
        </Card>
      ) : null}

      <OverviewThemeStyles css={theme.css} />
      <HTMLPreview content={data.body} className={theme.className} contentClassName={theme.className ? `${theme.className}__content` : undefined} />
    </div>
  );
};

function sanitizeMeta(value: Record<string, unknown> | undefined): KnowledgeOverviewV1Meta | undefined {
  if (!value) {
    return undefined;
  }
  const meta: KnowledgeOverviewV1Meta = {};
  if (typeof value.id === "number") {
    meta.id = value.id;
  } else if (typeof value.id === "string" && value.id.trim().length > 0) {
    const parsed = Number(value.id);
    if (!Number.isNaN(parsed)) {
      meta.id = parsed;
    }
  }
  if (typeof value.doc_type === "string") {
    meta.doc_type = value.doc_type;
  }
  if (typeof value.data_type === "string") {
    meta.data_type = value.data_type;
  }
  const restKeys = Object.keys(value).filter((key) => !["id", "doc_type", "data_type"].includes(key));
  for (const key of restKeys) {
    meta[key] = value[key];
  }
  return Object.keys(meta).length > 0 ? meta : undefined;
}
