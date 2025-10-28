import type { ReactNode } from "react";
import { Tag } from "antd";
import yaml from "js-yaml";

export function renderDifficultyTag(difficulty?: number) {
  if (typeof difficulty !== "number") {
    return <Tag color="default">难度：-</Tag>;
  }
  const color = difficulty >= 4 ? "red" : difficulty >= 3 ? "orange" : "green";
  return <Tag color={color}>难度：{difficulty}/5</Tag>;
}

export function renderNumber(value?: number, suffix?: string) {
  if (typeof value !== "number") {
    return "-";
  }
  return suffix ? `${value} ${suffix}` : String(value);
}

export function renderTagGroup(tags: string[] | undefined, options?: { inline?: boolean }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null;
  }
  const style = options?.inline ? { marginLeft: 8 } : {};
  return (
    <div style={{ marginTop: options?.inline ? 0 : 16 }}>
      {tags.map((tag, index) => (
        <Tag key={`${tag}-${index}`} color="blue" style={style}>
          {tag}
        </Tag>
      ))}
    </div>
  );
}

export function renderList(values: string[] | undefined): ReactNode {
  if (!Array.isArray(values) || values.length === 0) {
    return "-";
  }
  return values.map((value, index) => (
    <div key={`${value}-${index}`}>{value}</div>
  ));
}

export function stripHtmlTags(value?: string): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/<[^>]+>/g, "").trim();
}

export function parseFrontMatterHtml(content: string): { meta?: Record<string, unknown>; body: string } {
  if (!content) {
    return { body: "" };
  }
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    return { body: content };
  }

  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/m.exec(trimmed);
  if (!match) {
    return { body: content };
  }

  const [, frontMatter, body] = match;
  try {
    const parsed = yaml.load(frontMatter);
    if (isRecord(parsed)) {
      return { meta: parsed as Record<string, unknown>, body: body ?? "" };
    }
  } catch {
    // ignore errors, fall back to body content
  }
  return { body: body ?? "" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
