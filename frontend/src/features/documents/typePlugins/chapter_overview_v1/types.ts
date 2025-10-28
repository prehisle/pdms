export interface ChapterOverviewV1Meta {
  id?: number;
  doc_type?: string;
  data_type?: string;
  [key: string]: unknown;
}

export interface ChapterOverviewV1DocumentHtml {
  meta?: ChapterOverviewV1Meta;
  body: string;
}
