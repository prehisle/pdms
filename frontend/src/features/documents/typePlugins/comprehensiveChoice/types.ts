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
