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
