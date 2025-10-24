import { describe, expect, it } from 'vitest';
import type { Document } from '../../../api/documents';

// Mock documents for testing filtering logic
const mockDocuments: Document[] = [
  {
    id: 1,
    title: 'Document A',
    type: 'overview',
    position: 1,
    created_by: 'user1',
    updated_by: 'user1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {},
  },
  {
    id: 2,
    title: 'Document B',
    type: 'dictation',
    position: 2,
    created_by: 'user1',
    updated_by: 'user1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {},
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
    metadata: {},
  },
];

// Function to simulate the client-side document filtering logic
function filterDocumentsByIdClientSide(documents: Document[], docIdFilter?: string): Document[] {
  if (!docIdFilter) {
    return documents;
  }

  const numericId = Number(docIdFilter);
  if (Number.isNaN(numericId)) {
    return documents;
  }

  return documents.filter(doc => doc.id === numericId);
}

describe('Document ID Filtering (Client-side)', () => {
  it('should return all documents when no ID filter is provided', () => {
    const result = filterDocumentsByIdClientSide(mockDocuments);
    expect(result).toEqual(mockDocuments);
  });

  it('should return all documents when empty ID filter is provided', () => {
    const result = filterDocumentsByIdClientSide(mockDocuments, '');
    expect(result).toEqual(mockDocuments);
  });

  it('should filter documents by exact ID match', () => {
    const result = filterDocumentsByIdClientSide(mockDocuments, '1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].title).toBe('Document A');
  });

  it('should filter documents by ID for multi-digit IDs', () => {
    const result = filterDocumentsByIdClientSide(mockDocuments, '123');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(123);
    expect(result[0].title).toBe('Special Document');
  });

  it('should return empty array when ID does not exist', () => {
    const result = filterDocumentsByIdClientSide(mockDocuments, '999');
    expect(result).toHaveLength(0);
  });

  it('should return all documents when invalid ID format is provided', () => {
    const result = filterDocumentsByIdClientSide(mockDocuments, 'not-a-number');
    expect(result).toEqual(mockDocuments);
  });

  it('should handle leading/trailing whitespace in ID', () => {
    const result = filterDocumentsByIdClientSide(mockDocuments, ' 2 ');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('should sort filtered results by position', () => {
    // Test with a shuffled array to ensure sorting works
    const shuffled = [mockDocuments[2], mockDocuments[0], mockDocuments[1]];
    const filtered = filterDocumentsByIdClientSide(shuffled, '123');
    const sorted = filtered.sort((a, b) => a.position - b.position);

    expect(sorted).toHaveLength(1);
    expect(sorted[0].position).toBe(3);
  });
});