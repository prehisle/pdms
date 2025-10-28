import {
  DOCUMENT_TYPE_OPTIONS as RAW_DOCUMENT_TYPE_OPTIONS,
  DOCUMENT_TYPE_MAP,
  DOCUMENT_TYPE_DEFINITIONS,
} from "../../generated/documentTypes";

export const DOCUMENT_TYPES = Array.from(RAW_DOCUMENT_TYPE_OPTIONS, (option) => ({
  value: option.value,
  label: option.label,
}));

export { DOCUMENT_TYPE_MAP, DOCUMENT_TYPE_DEFINITIONS };

export const DOCUMENT_TYPE_KEYS = Object.keys(
  DOCUMENT_TYPE_MAP,
) as (keyof typeof DOCUMENT_TYPE_MAP)[];
