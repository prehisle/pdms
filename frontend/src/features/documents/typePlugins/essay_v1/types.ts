export interface EssayV1Meta {
  id?: number;
  doc_type?: string;
  data_type?: string;
  source?: string[];
}

export interface EssayV1DocumentYaml {
  meta?: EssayV1Meta;
  title?: string;
  content?: string;
  analysis?: string;
  digest?: string;
  sample?: string;
  theme_id?: number;
}
