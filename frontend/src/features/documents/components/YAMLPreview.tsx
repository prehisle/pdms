import { type FC, useMemo } from "react";
import yaml from "js-yaml";
import { Alert, Empty, Typography } from "antd";

import { resolveYamlPreview } from "../previewRegistry";
import type { YamlPreviewRenderResult } from "../previewRegistry";

const { Paragraph } = Typography;

interface YAMLPreviewProps {
  content: string;
  documentType?: string;
}

export const YAMLPreview: FC<YAMLPreviewProps> = ({ content, documentType }) => {
  const plugin = resolveYamlPreview(documentType);

  const pluginResult = useMemo<YamlPreviewRenderResult | undefined>(() => {
    if (!plugin) {
      return undefined;
    }
    return plugin.render(content, documentType);
  }, [plugin, content, documentType]);

  if (pluginResult) {
    switch (pluginResult.type) {
      case "empty":
        return <PreviewEmpty />;
      case "error":
        return <PreviewError message={pluginResult.message} />;
      case "component":
        return <>{pluginResult.node}</>;
      case "fallback":
        return <GenericYAMLPreview data={pluginResult.payload} />;
      default:
        return <GenericYAMLPreview data={pluginResult} />;
    }
  }

  return renderDefault(content);
};

function renderDefault(content: string) {
  if (!content || !content.trim()) {
    return <PreviewEmpty />;
  }

  try {
    const parsed = yaml.load(content);
    if (parsed == null) {
      return <PreviewEmpty />;
    }
    return <GenericYAMLPreview data={parsed} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return <PreviewError message={message} />;
  }
}

const PreviewEmpty: FC = () => (
  <div style={{ padding: "24px" }}>
    <Empty description="暂无内容，请在左侧编辑器中输入YAML代码" />
  </div>
);

const PreviewError: FC<{ message: string }> = ({ message }) => (
  <div style={{ padding: "24px" }}>
    <Alert type="error" message="YAML解析错误" description={message} showIcon />
  </div>
);

const GenericYAMLPreview: FC<{ data: unknown }> = ({ data }) => {
  let serialized = "";
  if (typeof data === "string") {
    serialized = data;
  } else {
    try {
      serialized = JSON.stringify(data, null, 2);
    } catch (error) {
      serialized = `无法序列化的数据: ${(error as Error).message}`;
    }
  }

  return (
    <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        未识别的 YAML 结构，以下显示原始数据：
      </Paragraph>
      <pre
        style={{
          background: "#f5f5f5",
          padding: "16px",
          borderRadius: "4px",
          overflow: "auto",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        {serialized}
      </pre>
    </div>
  );
};
