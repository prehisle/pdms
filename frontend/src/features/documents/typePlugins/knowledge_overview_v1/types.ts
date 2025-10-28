export interface KnowledgeOverviewV1Meta {
  id?: number;
  doc_type?: string;
  data_type?: string;
  [key: string]: unknown;
}

export interface KnowledgeOverviewV1DocumentHtml {
  meta?: KnowledgeOverviewV1Meta;
  body: string;
}
