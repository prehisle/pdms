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
