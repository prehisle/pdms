package service

import (
	"context"
	"fmt"
	"net/url"

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
	return s.ndr.ListDocuments(ctx, toNDRMeta(meta), query)
}

// ListNodeDocuments fetches documents attached to the node subtree.
func (s *Service) ListNodeDocuments(ctx context.Context, meta RequestMeta, nodeID int64, query url.Values) ([]ndrclient.Document, error) {
	return s.ndr.ListNodeDocuments(ctx, toNDRMeta(meta), nodeID, query)
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
