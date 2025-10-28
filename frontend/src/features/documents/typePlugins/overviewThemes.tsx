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

const DEFAULT_THEME: OverviewTheme = {
  id: "__default",
  label: "默认",
  className: "",
};

export interface OverviewThemeHookResult {
  theme: OverviewTheme;
  selector: ReactNode | null;
}

export function useOverviewTheme(documentTypeId: string): OverviewThemeHookResult {
  const themes = useMemo(() => {
    const entry =
      (DOCUMENT_TYPE_THEMES as Record<string, readonly { id: string; label: string; description?: string; css?: string }[] | undefined>)[
        documentTypeId
      ] ?? [];
    return entry.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      css: item.css,
      className: `overview-theme-${item.id}`,
    }));
  }, [documentTypeId]);

  const [themeId, setThemeId] = useState<string>(themes[0]?.id ?? DEFAULT_THEME.id);

  useEffect(() => {
    if (themes.length === 0) {
      setThemeId(DEFAULT_THEME.id);
      return;
    }
    if (!themes.some((theme) => theme.id === themeId)) {
      setThemeId(themes[0].id);
    }
  }, [themes, themeId]);

  const theme = useMemo(() => {
    if (themes.length === 0) {
      return DEFAULT_THEME;
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

  const selector = themes.length > 0 ? (
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
  ) : null;

  return { theme, selector };
}

export const OverviewThemeStyles: FC<{ css?: string }> = ({ css }) => {
  if (!css) {
    return null;
  }
  return <style>{css}</style>;
};
