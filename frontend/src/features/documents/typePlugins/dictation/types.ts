export interface DictationContent {
  text?: string;
  pinyin?: string;
}

export interface DictationDocumentYaml {
  title?: string;
  type?: string;
  difficulty?: number;
  points?: number;
  time_limit?: number;
  content?: DictationContent;
  hints?: string[];
  answer_key?: string;
  tags?: string[];
}
