import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDocument,
  updateDocument,
  reorderDocuments,
  getNodeDocuments,
  type Document,
  type DocumentCreatePayload,
  type DocumentUpdatePayload,
  type DocumentReorderPayload,
} from '../documents';

// Mock the http utility
vi.mock('../http', () => ({
  http: vi.fn(),
  buildQuery: vi.fn((params) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query.append(key, String(value));
      }
    });
    const result = query.toString();
    return result ? `?${result}` : '';
  }),
}));

const mockHttp = vi.hoisted(() => vi.fn());

beforeEach(() => {
  vi.clearAllMocks();
  // Import http after mocking
  const { http } = require('../http');
  http.mockImplementation(mockHttp);
});

describe('documents API', () => {
  describe('createDocument', () => {
    it('should create document with type and position', async () => {
      const mockDocument: Document = {
        id: 1,
        title: 'Test Document',
        type: 'overview',
        position: 5,
        content: { format: 'html', data: '<p>Test content</p>' },
        created_by: 'user1',
        updated_by: 'user1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        metadata: {},
      };

      mockHttp.mockResolvedValue(mockDocument);

      const payload: DocumentCreatePayload = {
        title: 'Test Document',
        type: 'overview',
        position: 5,
        content: { format: 'html', data: '<p>Test content</p>' },
      };

      const result = await createDocument(payload);

      expect(mockHttp).toHaveBeenCalledWith('/api/v1/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(mockDocument);
    });

    it('should create document without optional fields', async () => {
      const mockDocument: Document = {
        id: 2,
        title: 'Simple Document',
        position: 1,
        created_by: 'user1',
        updated_by: 'user1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        metadata: {},
      };

      mockHttp.mockResolvedValue(mockDocument);

      const payload: DocumentCreatePayload = {
        title: 'Simple Document',
      };

      const result = await createDocument(payload);

      expect(mockHttp).toHaveBeenCalledWith('/api/v1/documents', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(mockDocument);
    });
  });

  describe('updateDocument', () => {
    it('should update document with new type and position', async () => {
      const mockDocument: Document = {
        id: 1,
        title: 'Updated Document',
        type: 'dictation',
        position: 3,
        created_by: 'user1',
        updated_by: 'user1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T12:00:00Z',
        metadata: {},
      };

      mockHttp.mockResolvedValue(mockDocument);

      const payload: DocumentUpdatePayload = {
        title: 'Updated Document',
        type: 'dictation',
        position: 3,
      };

      const result = await updateDocument(1, payload);

      expect(mockHttp).toHaveBeenCalledWith('/api/v1/documents/1', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(mockDocument);
    });
  });

  describe('reorderDocuments', () => {
    it('should reorder documents successfully', async () => {
      const mockDocuments: Document[] = [
        {
          id: 2,
          title: 'Document B',
          type: 'overview',
          position: 1,
          created_by: 'user1',
          updated_by: 'user1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          metadata: {},
        },
        {
          id: 1,
          title: 'Document A',
          type: 'overview',
          position: 2,
          created_by: 'user1',
          updated_by: 'user1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          metadata: {},
        },
      ];

      mockHttp.mockResolvedValue(mockDocuments);

      const payload: DocumentReorderPayload = {
        ordered_ids: [2, 1],
      };

      const result = await reorderDocuments(payload);

      expect(mockHttp).toHaveBeenCalledWith('/api/v1/documents/reorder', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(mockDocuments);
    });
  });

  describe('getNodeDocuments', () => {
    it('should fetch documents with type filter', async () => {
      const mockDocuments: Document[] = [
        {
          id: 1,
          title: 'Overview Doc',
          type: 'overview',
          position: 1,
          created_by: 'user1',
          updated_by: 'user1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          metadata: {},
        },
      ];

      mockHttp.mockResolvedValue(mockDocuments);

      const result = await getNodeDocuments(100, {
        type: 'overview',
        include_descendants: true,
      });

      expect(mockHttp).toHaveBeenCalledWith('/api/v1/nodes/100/subtree-documents?type=overview&include_descendants=true');
      expect(result).toEqual(mockDocuments);
    });

    it('should fetch documents with query filter', async () => {
      const mockDocuments: Document[] = [
        {
          id: 2,
          title: 'Search Result',
          type: 'dictation',
          position: 1,
          created_by: 'user1',
          updated_by: 'user1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          metadata: {},
        },
      ];

      mockHttp.mockResolvedValue(mockDocuments);

      const result = await getNodeDocuments(100, {
        query: 'search term',
        include_descendants: false,
      });

      expect(mockHttp).toHaveBeenCalledWith('/api/v1/nodes/100/subtree-documents?query=search%20term&include_descendants=false');
      expect(result).toEqual(mockDocuments);
    });

    it('should fetch documents with id filter', async () => {
      const mockDocuments: Document[] = [
        {
          id: 123,
          title: 'Specific Document',
          type: 'overview',
          position: 1,
          created_by: 'user1',
          updated_by: 'user1',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          metadata: {},
        },
      ];

      mockHttp.mockResolvedValue(mockDocuments);

      const result = await getNodeDocuments(100, {
        id: [123, 456],
        include_descendants: true,
      });

      expect(mockHttp).toHaveBeenCalledWith('/api/v1/nodes/100/subtree-documents?id=123&id=456&include_descendants=true');
      expect(result).toEqual(mockDocuments);
    });
  });
});
