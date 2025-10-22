import { describe, expect, it, vi } from 'vitest';
import type { Document } from '../../../api/documents';
import type { DocumentFilterFormValues } from '../types';

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
  params.size = 100;
  params.include_descendants = includeDescendants;

  let docs = await mockGetNodeDocuments(selectedNodeId, params);

  // Client-side filtering by document ID if specified
  if (documentFilters.docId) {
    const numericId = Number(documentFilters.docId);
    if (!Number.isNaN(numericId)) {
      docs = docs.filter((doc: Document) => doc.id === numericId);
    }
  }

  // Sort by position to maintain consistent order
  return docs.sort((a: Document, b: Document) => a.position - b.position);
}

describe('Document Query Logic', () => {
  const mockDocuments: Document[] = [
    {
      id: 1,
      title: 'First Document',
      type: 'markdown',
      position: 2,
      created_by: 'user1',
      updated_by: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      metadata: {},
    },
    {
      id: 2,
      title: 'Second Document',
      type: 'html',
      position: 1,
      created_by: 'user1',
      updated_by: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      metadata: {},
    },
    {
      id: 123,
      title: 'Special Document',
      type: 'markdown',
      position: 3,
      created_by: 'user1',
      updated_by: 'user1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      metadata: {},
    },
  ];

  beforeEach(() => {
    mockGetNodeDocuments.mockResolvedValue([...mockDocuments]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call API without id parameter and filter client-side', async () => {
    const filters: DocumentFilterFormValues = {
      docId: '123',
      type: 'markdown',
    };

    const result = await simulateDocumentQuery(100, filters, true);

    // Check that API was called without id parameter
    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      type: 'markdown',
      size: 100,
      include_descendants: true,
    });

    // Check that client-side filtering worked
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(123);
    expect(result[0].title).toBe('Special Document');
  });

  it('should return documents sorted by position when no ID filter', async () => {
    const filters: DocumentFilterFormValues = {
      type: 'markdown',
    };

    const result = await simulateDocumentQuery(100, filters, true);

    expect(result).toHaveLength(2); // Two markdown docs
    expect(result[0].position).toBe(2); // First doc by position
    expect(result[1].position).toBe(3); // Second doc by position
  });

  it('should handle invalid document ID gracefully', async () => {
    const filters: DocumentFilterFormValues = {
      docId: 'not-a-number',
    };

    const result = await simulateDocumentQuery(100, filters, true);

    // Should return all documents since ID filter is invalid
    expect(result).toHaveLength(3);
    expect(result[0].position).toBe(1); // Sorted by position
  });

  it('should filter by non-existent ID', async () => {
    const filters: DocumentFilterFormValues = {
      docId: '999',
    };

    const result = await simulateDocumentQuery(100, filters, true);

    expect(result).toHaveLength(0);
  });

  it('should combine multiple filters correctly', async () => {
    const filters: DocumentFilterFormValues = {
      docId: '1',
      query: 'search term',
      type: 'markdown',
    };

    const result = await simulateDocumentQuery(100, filters, false);

    // API should be called with query and type, but not id
    expect(mockGetNodeDocuments).toHaveBeenCalledWith(100, {
      query: 'search term',
      type: 'markdown',
      size: 100,
      include_descendants: false,
    });

    // Client-side filtering should apply to the result
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
});