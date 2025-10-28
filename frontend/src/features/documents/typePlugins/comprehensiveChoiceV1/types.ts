export interface ComprehensiveChoiceV1Option {
  key?: string;
  content?: string;
}

export interface ComprehensiveChoiceV1SubQuestion {
  options?: ComprehensiveChoiceV1Option[];
  answer?: string;
}

export interface ComprehensiveChoiceV1Meta {
  id?: number;
  doc_type?: string;
  data_type?: string;
  source?: string[];
}

export interface ComprehensiveChoiceV1Body {
  title?: string;
  analysis?: string;
  sub_questions?: ComprehensiveChoiceV1SubQuestion[];
}

export interface ComprehensiveChoiceV1DocumentYaml {
  meta?: ComprehensiveChoiceV1Meta;
  body?: ComprehensiveChoiceV1Body;
}
