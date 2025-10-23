export interface DocumentFilterFormValues {
  docId?: string;
  query?: string;
  type?: string;
}

export interface DocumentFormValues {
  title: string;
  type: string;
  position?: number;
  content?: string;
}
