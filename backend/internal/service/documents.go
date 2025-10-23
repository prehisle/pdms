package service

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// DocumentCreateRequest represents the payload required to create a document.
type DocumentCreateRequest struct {
	Title    string         `json:"title"`
	Metadata map[string]any `json:"metadata,omitempty"`
	Content  map[string]any `json:"content,omitempty"`
	Type     *string        `json:"type,omitempty"`
	Position *int           `json:"position,omitempty"`
}

// ListDocuments fetches a paginated list of documents from NDR.
func (s *Service) ListDocuments(ctx context.Context, meta RequestMeta, query url.Values) (ndrclient.DocumentsPage, error) {
	page, err := s.ndr.ListDocuments(ctx, toNDRMeta(meta), query)
	if err != nil {
		return ndrclient.DocumentsPage{}, err
	}

	ids := extractIDFilter(query)
	if len(ids) == 0 {
		return page, nil
	}

	filtered := filterDocumentsByID(page.Items, ids)
	page.Items = filtered
	page.Total = len(filtered)
	page.Size = len(filtered)
	return page, nil
}

// ListNodeDocuments fetches documents attached to the node subtree.
func (s *Service) ListNodeDocuments(ctx context.Context, meta RequestMeta, nodeID int64, query url.Values) ([]ndrclient.Document, error) {
	docs, err := s.ndr.ListNodeDocuments(ctx, toNDRMeta(meta), nodeID, query)
	if err != nil {
		return nil, err
	}

	ids := extractIDFilter(query)
	if len(ids) == 0 {
		return docs, nil
	}

	return filterDocumentsByID(docs, ids), nil
}

// CreateDocument creates a new document upstream.
func (s *Service) CreateDocument(ctx context.Context, meta RequestMeta, payload DocumentCreateRequest) (ndrclient.Document, error) {
	body := ndrclient.DocumentCreate{
		Title:    payload.Title,
		Metadata: payload.Metadata,
		Content:  payload.Content,
		Type:     payload.Type,
		Position: payload.Position,
	}

	// If no position is specified, NDR will assign the next available position automatically
	return s.ndr.CreateDocument(ctx, toNDRMeta(meta), body)
}

// BindDocument associates a document with a specific node.
func (s *Service) BindDocument(ctx context.Context, meta RequestMeta, nodeID, docID int64) error {
	return s.ndr.BindDocument(ctx, toNDRMeta(meta), nodeID, docID)
}

// DocumentUpdateRequest represents the payload required to update a document.
type DocumentUpdateRequest struct {
	Title    *string        `json:"title,omitempty"`
	Content  map[string]any `json:"content,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
	Type     *string        `json:"type,omitempty"`
	Position *int           `json:"position,omitempty"`
}

// UpdateDocument updates an existing document upstream.
func (s *Service) UpdateDocument(ctx context.Context, meta RequestMeta, docID int64, payload DocumentUpdateRequest) (ndrclient.Document, error) {
	body := ndrclient.DocumentUpdate{
		Title:    payload.Title,
		Content:  payload.Content,
		Metadata: payload.Metadata,
		Type:     payload.Type,
		Position: payload.Position,
	}
	return s.ndr.UpdateDocument(ctx, toNDRMeta(meta), docID, body)
}

// DocumentReorderRequest represents a request to reorder documents within a node.
type DocumentReorderRequest struct {
	NodeID     int64   `json:"node_id"`
	OrderedIDs []int64 `json:"ordered_ids"`
}

// ReorderDocuments reorders documents within a specific node by updating their positions.
func (s *Service) ReorderDocuments(ctx context.Context, meta RequestMeta, req DocumentReorderRequest) ([]ndrclient.Document, error) {
	if len(req.OrderedIDs) == 0 {
		return nil, fmt.Errorf("ordered_ids cannot be empty")
	}

	// Update each document's position based on its order in the array
	var updatedDocs []ndrclient.Document
	for i, docID := range req.OrderedIDs {
		position := i + 1 // Position is 1-based
		updateReq := DocumentUpdateRequest{
			Position: &position,
		}

		doc, err := s.UpdateDocument(ctx, meta, docID, updateReq)
		if err != nil {
			return nil, fmt.Errorf("failed to update document %d position: %w", docID, err)
		}
		updatedDocs = append(updatedDocs, doc)
	}

	return updatedDocs, nil
}

func extractIDFilter(query url.Values) map[int64]struct{} {
	if query == nil {
		return nil
	}
	raw := query["id"]
	if len(raw) == 0 {
		return nil
	}
	ids := make(map[int64]struct{}, len(raw))
	for _, value := range raw {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		id, err := strconv.ParseInt(trimmed, 10, 64)
		if err != nil {
			continue
		}
		ids[id] = struct{}{}
	}
	if len(ids) == 0 {
		return nil
	}
	return ids
}

func filterDocumentsByID(items []ndrclient.Document, ids map[int64]struct{}) []ndrclient.Document {
	if len(ids) == 0 {
		return items
	}
	filtered := make([]ndrclient.Document, 0, len(items))
	for _, doc := range items {
		if _, ok := ids[doc.ID]; ok {
			filtered = append(filtered, doc)
		}
	}
	return filtered
}
