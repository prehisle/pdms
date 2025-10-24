import { describe, expect, it, vi } from 'vitest';
import type { Document } from '../../../api/documents';
import type {
  DocumentFilterFormValues,
  MetadataFilterFormValue,
  MetadataValueType,
} from '../types';

interface SanitizedMetadataFilter extends MetadataFilterFormValue {
  key: string;
  type: MetadataValueType;
  value: string | string[];
}

// Mock the getNodeDocuments function
const mockGetNodeDocuments = vi.fn();

// Simulate the document query logic from App.tsx
async function simulateDocumentQuery(
  selectedNodeId: number,
  documentFilters: DocumentFilterFormValues,
  includeDescendants: boolean
): Promise<Document[]> {
  const params: any = {};

  if (documentFilters.query?.trim()) {
    params.query = documentFilters.query.trim();
  }
  if (documentFilters.type) {
    params.type = documentFilters.type;
  }
  if (documentFilters.docId) {
    const numericId = Number(documentFilters.docId);
    if (!Number.isNaN(numericId)) {
      params.id = [numericId];
    }
  }
  const metadataFilters = sanitizeMetadataFilters(documentFilters.metadataFilters);
  const metadataQuery = buildMetadataQuery(metadataFilters);
  if (metadataQuery && Object.keys(metadataQuery).length > 0) {
    params.metadata = metadataQuery;
  }
  params.size = 100;
  params.include_descendants = includeDescendants;

  const docs = await mockGetNodeDocuments(selectedNodeId, params);

  // Sort by position to maintain consistent order
  return docs.sort((a: Document, b: Document) => a.position - b.position);
}

describe('Document Query Logic', () => {
  const mockDocuments: Document[] = [
    {
      id: 1,
      title: 'First Document',
      type: 'overview',
      position: 2,
      created_by: 'user1',
      updated_by: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      metadata: { difficulty: 3, tags: ['grammar', 'reading'], source: 'internal' },
    },
    {
      id: 2,
      title: 'Second Document',
      type: 'dictation',
      position: 1,
      created_by: 'user1',
      updated_by: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      metadata: { difficulty: 2, tags: ['listening'] },
    },
    {
      id: 123,
      title: 'Special Document',
      type: 'overview',
      position: 3,
      created_by: 'user1',
      updated_by: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      metadata: { difficulty: 5 },
    },
  ];

  beforeEach(() => {
    mockGetNodeDocuments.mockImplementation((selectedNodeId, params) => {
      let filteredDocs = [...mockDocuments];

      // Server-side filtering by ID if provided
      if (params.id && params.id.length > 0) {
        filteredDocs = filteredDocs.filter(doc => params.id.includes(doc.id));
      }

      // Server-side filtering by type if provided
      if (params.type) {
        filteredDocs = filteredDocs.filter(doc => doc.type === params.type);
      }

      if (params.metadata) {
        const metadataEntries = Object.entries(params.metadata);
        filteredDocs = filteredDocs.filter((doc) =>
          metadataEntries.every(([metadataKey, expectedValue]) => {
            const value = (doc.metadata ?? {})[metadataKey];
            if (Array.isArray(expectedValue)) {
              if (!Array.isArray(value)) {
                return false;
              }
              const normalizedValue = value.map(String);
              return expectedValue.every((item) => normalizedValue.includes(String(item)));
            }
            return value === expectedValue;
          }),
        );
      }

      return Promise.resolve(filteredDocs);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call API with id parameter for server-side filtering', async () => {
    const filters: DocumentFilterFormValues = {
      docId: '123',
      type: 'overview',
    };

    const result = await simulateDocumentQuery(100, filters, true);

    // Check that API was called with id parameter
    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      type: 'overview',
      id: [123],
      size: 100,
      include_descendants: true,
    });

    // Check that server-side filtering worked
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(123);
    expect(result[0].title).toBe('Special Document');
  });

  it('should return documents sorted by position when no ID filter', async () => {
    const filters: DocumentFilterFormValues = {
      type: 'overview',
    };

    const result = await simulateDocumentQuery(100, filters, true);

    expect(result).toHaveLength(2); // Two overview docs
    expect(result[0].position).toBe(2); // First doc by position
    expect(result[1].position).toBe(3); // Second doc by position
  });

  it('should handle invalid document ID gracefully', async () => {
    const filters: DocumentFilterFormValues = {
      docId: 'not-a-number',
    };

    const result = await simulateDocumentQuery(100, filters, true);

    // Check that API was called without id parameter since it's invalid
    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      size: 100,
      include_descendants: true,
    });

    // Should return all documents since ID filter is invalid
    expect(result).toHaveLength(3);
    expect(result[0].position).toBe(1); // Sorted by position
  });

  it('should filter by non-existent ID', async () => {
    const filters: DocumentFilterFormValues = {
      docId: '999',
    };

    const result = await simulateDocumentQuery(100, filters, true);

    // Check that API was called with id parameter
    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      id: [999],
      size: 100,
      include_descendants: true,
    });

    expect(result).toHaveLength(0);
  });

  it('should combine multiple filters correctly', async () => {
    const filters: DocumentFilterFormValues = {
      docId: '1',
      query: 'search term',
      type: 'overview',
      metadataFilters: [
        { key: 'difficulty', type: 'number', value: '3' },
      ],
    };

    const result = await simulateDocumentQuery(100, filters, false);

    // API should be called with query, type, and id parameters
    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      query: 'search term',
      type: 'overview',
      id: [1],
      metadata: { difficulty: 3 },
      size: 100,
      include_descendants: false,
    });

    // Server-side filtering should apply to the result
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('should trim query parameter', async () => {
    const filters: DocumentFilterFormValues = {
      query: '  trimmed query  ',
    };

    await simulateDocumentQuery(100, filters, true);

    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      query: 'trimmed query',
      size: 100,
      include_descendants: true,
    });
  });

  it('should filter by metadata tags', async () => {
    const filters: DocumentFilterFormValues = {
      metadataFilters: [
        { key: 'tags', type: 'string', value: 'grammar' },
      ],
    };

    const result = await simulateDocumentQuery(100, filters, true);

    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      metadata: { tags: 'grammar' },
      size: 100,
      include_descendants: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('should filter by metadata tags array', async () => {
    const filters: DocumentFilterFormValues = {
      metadataFilters: [
        { key: 'tags', type: 'string[]', value: ['grammar'] },
      ],
    };

    const result = await simulateDocumentQuery(100, filters, true);

    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      metadata: { tags: ['grammar'] },
      size: 100,
      include_descendants: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

function sanitizeMetadataFilters(
  filters?: MetadataFilterFormValue[],
): SanitizedMetadataFilter[] | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  const sanitized: SanitizedMetadataFilter[] = [];
  filters.forEach((filter) => {
    const key = filter.key?.trim();
    if (!key) {
      return;
    }
    const type: MetadataValueType = filter.type ?? 'string';
    switch (type) {
      case 'string': {
        const value = typeof filter.value === 'string' ? filter.value.trim() : '';
        if (value) {
          sanitized.push({ key, type, value });
        }
        break;
      }
      case 'number': {
        const value = typeof filter.value === 'string' ? filter.value.trim() : '';
        if (value && !Number.isNaN(Number(value))) {
          sanitized.push({ key, type, value });
        }
        break;
      }
      case 'boolean': {
        const raw = typeof filter.value === 'string' ? filter.value : '';
        if (raw === 'true' || raw === 'false') {
          sanitized.push({ key, type, value: raw });
        }
        break;
      }
      case 'string[]': {
        const raw = Array.isArray(filter.value) ? filter.value : [];
        const value = Array.from(
          new Set(raw.map((item) => item.trim()).filter((item) => item.length > 0)),
        );
        if (value.length > 0) {
          sanitized.push({ key, type, value });
        }
        break;
      }
      default:
        break;
    }
  });
  return sanitized.length > 0 ? sanitized : undefined;
}

function buildMetadataQuery(
  filters?: SanitizedMetadataFilter[],
): Record<string, string | number | boolean | string[]> | undefined {
  if (!filters || filters.length === 0) {
    return undefined;
  }
  const result: Record<string, string | number | boolean | string[]> = {};
  filters.forEach(({ key, type = 'string', value }) => {
    switch (type) {
      case 'string':
        if (typeof value === 'string' && value.length > 0) {
          result[key] = value;
        }
        break;
      case 'number':
        if (typeof value === 'string' && value.length > 0) {
          const numeric = Number(value);
          if (!Number.isNaN(numeric)) {
            result[key] = numeric;
          }
        }
        break;
      case 'boolean':
        if (value === 'true') {
          result[key] = true;
        } else if (value === 'false') {
          result[key] = false;
        }
        break;
      case 'string[]':
        if (Array.isArray(value) && value.length > 0) {
          result[key] = value;
        }
        break;
      default:
        break;
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
}
