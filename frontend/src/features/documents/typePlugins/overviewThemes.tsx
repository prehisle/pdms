import { useEffect, useMemo, useState } from "react";
import type { FC, ReactNode } from "react";
import { Select, Space, Typography } from "antd";

import { DOCUMENT_TYPE_THEMES } from "../../../generated/documentTypeThemes";

export interface OverviewTheme {
  id: string;
  label: string;
  className: string;
  css?: string;
  description?: string;
}

const classicCss = `
.overview-theme-classic .html-preview-content {
  background: #ffffff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(24, 144, 255, 0.08);
}
.overview-theme-classic .html-preview-content .yjxt-content-card {
  border: 1px solid rgba(24, 144, 255, 0.12);
  box-shadow: 0 4px 16px rgba(24, 144, 255, 0.08);
}
.overview-theme-classic .html-preview-content .yjxt-card-title {
  color: #177ddc;
  border-bottom: 2px solid rgba(23, 125, 220, 0.2);
}
.overview-theme-classic .html-preview-content .yjxt-section-title {
  border-bottom: 2px solid rgba(23, 125, 220, 0.2);
  color: #0c66c2;
}
`;

const warmCss = `
.overview-theme-warm .html-preview-content {
  background: linear-gradient(135deg, #fff7f0, #fffefd);
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 12px 32px rgba(255, 125, 0, 0.08);
}
.overview-theme-warm .html-preview-content .yjxt-content-card {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(255, 140, 0, 0.15);
  box-shadow: 0 4px 18px rgba(255, 140, 0, 0.12);
}
.overview-theme-warm .html-preview-content .yjxt-card-title {
  color: #d46b08;
  border-bottom: 2px solid rgba(212, 107, 8, 0.2);
}
.overview-theme-warm .html-preview-content .yjxt-section-title {
  color: #ad4e00;
  border-bottom: 2px solid rgba(173, 78, 0, 0.2);
}
.overview-theme-warm .html-preview-content .yjxt-point-title,
.overview-theme-warm .html-preview-content h2 {
  color: #ad4e00;
}
`;

const nightCss = `
.overview-theme-night .html-preview-content {
  background: linear-gradient(135deg, #20293a, #101522);
  border-radius: 16px;
  padding: 28px;
  color: #f5f7fa;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.45);
}
.overview-theme-night .html-preview-content .yjxt-content-card {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.45);
}
.overview-theme-night .html-preview-content .yjxt-card-title,
.overview-theme-night .html-preview-content .yjxt-section-title,
.overview-theme-night .html-preview-content .yjxt-point-title {
  color: #60a5fa;
  border-bottom: 1px solid rgba(96, 165, 250, 0.3);
}
.overview-theme-night .html-preview-content .yjxt-summary-list li::before,
.overview-theme-night .html-preview-content .yjxt-advice-content li::before,
.overview-theme-night .html-preview-content .yjxt-bullet-list li::before {
  background: #60a5fa;
}
.overview-theme-night .html-preview-content p,
.overview-theme-night .html-preview-content li {
  color: #e2e8f0;
}
`;

const BASE_OVERVIEW_THEMES: OverviewTheme[] = [
  {
    id: "classic",
    label: "经典蓝",
    className: "overview-theme-classic",
    css: classicCss,
  },
  {
    id: "warm",
    label: "暖色晨曦",
    className: "overview-theme-warm",
    css: warmCss,
  },
  {
    id: "night",
    label: "夜间沉浸",
    className: "overview-theme-night",
    css: nightCss,
  },
];

export interface OverviewThemeHookResult {
  theme: OverviewTheme;
  selector: ReactNode;
}

export function useOverviewTheme(documentTypeId: string): OverviewThemeHookResult {
  const extraThemes = useMemo(() => {
    const entry = (DOCUMENT_TYPE_THEMES as Record<string, readonly { id: string; label: string; description?: string; css?: string }[] | undefined>)[documentTypeId];
    if (!entry) {
      return [] as OverviewTheme[];
    }
    return entry.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      css: item.css,
      className: `overview-theme-${item.id}`,
    }));
  }, [documentTypeId]);

  const themes = useMemo(() => {
    const merged: OverviewTheme[] = [];
    const seen = new Set<string>();
    for (const theme of [...BASE_OVERVIEW_THEMES, ...extraThemes]) {
      if (theme && !seen.has(theme.id)) {
        seen.add(theme.id);
        merged.push(theme);
      }
    }
    return merged;
  }, [extraThemes]);

  const [themeId, setThemeId] = useState<string>(themes[0]?.id ?? "");

  useEffect(() => {
    if (themes.length === 0) {
      return;
    }
    if (!themes.some((theme) => theme.id === themeId)) {
      setThemeId(themes[0].id);
    }
  }, [themes, themeId]);

  const theme = useMemo(() => {
    if (themes.length === 0) {
      return BASE_OVERVIEW_THEMES[0];
    }
    return themes.find((item) => item.id === themeId) ?? themes[0];
  }, [themes, themeId]);

  const options = useMemo(
    () =>
      themes.map((item) => ({
        value: item.id,
        label: item.label,
        title: item.description,
      })),
    [themes],
  );

  const selector = (
    <Space size={4} align="center">
      <Typography.Text type="secondary">主题：</Typography.Text>
      <Select
        value={theme.id}
        onChange={setThemeId}
        size="small"
        options={options}
        style={{ minWidth: 160 }}
        dropdownMatchSelectWidth={false}
      />
    </Space>
  );

  return { theme, selector };
}

export const OverviewThemeStyles: FC<{ css?: string }> = ({ css }) => {
  if (!css) {
    return null;
  }
  return <style>{css}</style>;
};
