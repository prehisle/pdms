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
