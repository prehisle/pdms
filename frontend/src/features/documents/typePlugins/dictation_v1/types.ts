export interface DictationV1Meta {
  id?: number;
  doc_type?: string;
  question_type?: string;
  source?: string[];
}

export interface DictationV1Detail {
  no?: number | string;
  question?: string;
  answer?: string;
  type?: string;
  km_point?: string;
}

export interface DictationV1DocumentYaml {
  meta?: DictationV1Meta;
  study_time?: unknown;
  details?: DictationV1Detail[];
}
