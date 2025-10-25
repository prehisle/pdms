import type { MetadataOperator } from "../../api/documents";

export interface DocumentFormValues {
  title: string;
  type: string;
  position?: number;
  content?: string;
}

export type MetadataValueType = "string" | "number" | "boolean" | "string[]";

export interface MetadataFilterFormValue {
  key?: string;
  operator?: MetadataOperator;
  value?: string | string[];
}

export interface DocumentFilterFormValues {
  docId?: string;
  query?: string;
  type?: string;
  tags?: string[];
  metadataFilters?: MetadataFilterFormValue[];
}

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

export interface ComprehensiveChoiceOption {
  id?: string;
  content?: string;
  is_correct?: boolean;
}

export interface ComprehensiveChoiceBlank {
  blank_id?: number;
  position?: number;
  question?: string;
  options?: ComprehensiveChoiceOption[];
}

export interface ComprehensiveChoiceDocumentYaml {
  title?: string;
  description?: string;
  stem?: string;
  blanks?: ComprehensiveChoiceBlank[];
  correct_answer?: string;
  explanation?: string;
  difficulty?: number;
  points?: number;
  tags?: string[];
}

export interface CaseAnalysisQuestion {
  question_id?: number;
  content?: string;
  points?: number;
  reference_answer?: string;
  grading_criteria?: string[];
}

export interface CaseAnalysisDocumentYaml {
  title?: string;
  case_background?: string;
  questions?: CaseAnalysisQuestion[];
  difficulty?: number;
  total_points?: number;
  time_limit?: number;
  tags?: string[];
}

export interface EssayCriterion {
  criterion?: string;
  points?: number;
  description?: string;
}

export interface EssayWordLimit {
  min?: number;
  max?: number;
}

export interface EssayDocumentYaml {
  title?: string;
  topic?: string;
  description?: string;
  requirements?: string;
  word_limit?: EssayWordLimit;
  outline_suggestion?: string[];
  grading_criteria?: EssayCriterion[];
  reference_materials?: string[];
  difficulty?: number;
  total_points?: number;
  time_limit?: number;
  tags?: string[];
}
