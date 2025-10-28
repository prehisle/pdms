import type { ReactNode } from "react";

export type YamlPreviewRenderResult =
  | { type: "empty" }
  | { type: "error"; message: string }
  | { type: "component"; node: ReactNode }
  | { type: "fallback"; payload: unknown };

export interface YamlPreviewPlugin {
  render: (content: string, documentType?: string) => YamlPreviewRenderResult;
}

const registry = new Map<string, YamlPreviewPlugin>();

export function registerYamlPreview(documentType: string, plugin: YamlPreviewPlugin) {
  registry.set(documentType, plugin);
}

export function resolveYamlPreview(documentType?: string): YamlPreviewPlugin | undefined {
  if (!documentType) {
    return undefined;
  }
  return registry.get(documentType);
}

export function listRegisteredPreviewTypes(): string[] {
  return Array.from(registry.keys());
}
