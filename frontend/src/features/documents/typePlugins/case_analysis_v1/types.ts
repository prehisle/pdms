export interface CaseAnalysisV1Meta {
  id?: number;
  doc_type?: string;
  data_type?: string;
  source?: string[];
}

export interface CaseAnalysisV1Detail {
  no?: number | string;
  question?: string;
  answer?: string;
  score?: number;
  type?: string;
}

export interface CaseAnalysisV1DocumentYaml {
  meta?: CaseAnalysisV1Meta;
  title?: string;
  analysis?: string;
  details?: CaseAnalysisV1Detail[];
}
