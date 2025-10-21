package service

import (
	"context"
	"net/url"

	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// DocumentCreateRequest represents the payload required to create a document.
type DocumentCreateRequest struct {
	Title    string         `json:"title"`
	Metadata map[string]any `json:"metadata,omitempty"`
	Content  map[string]any `json:"content,omitempty"`
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
	}
	return s.ndr.CreateDocument(ctx, toNDRMeta(meta), body)
}

// BindDocument associates a document with a specific node.
func (s *Service) BindDocument(ctx context.Context, meta RequestMeta, nodeID, docID int64) error {
	return s.ndr.BindDocument(ctx, toNDRMeta(meta), nodeID, docID)
}
