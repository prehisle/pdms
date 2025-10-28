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

// ListDeletedDocuments returns documents that are currently soft-deleted.
func (s *Service) ListDeletedDocuments(ctx context.Context, meta RequestMeta, query url.Values) (ndrclient.DocumentsPage, error) {
	if query == nil {
		query = url.Values{}
	}
	query.Set("include_deleted", "true")

	page, err := s.ndr.ListDocuments(ctx, toNDRMeta(meta), query)
	if err != nil {
		return ndrclient.DocumentsPage{}, err
	}

	filtered := make([]ndrclient.Document, 0, len(page.Items))
	for _, doc := range page.Items {
		if doc.DeletedAt != nil {
			filtered = append(filtered, doc)
		}
	}

	page.Items = filtered
	page.Total = len(filtered)
	page.Size = len(filtered)
	return page, nil
}

// CreateDocument creates a new document upstream.
func (s *Service) CreateDocument(ctx context.Context, meta RequestMeta, payload DocumentCreateRequest) (ndrclient.Document, error) {
	// Validate document type if provided
	if payload.Type != nil {
		if !IsValidDocumentType(*payload.Type) {
			return ndrclient.Document{}, fmt.Errorf("invalid document type: %s. Valid types: %v", *payload.Type, ValidDocumentTypes())
		}

		// Validate content structure
		if err := ValidateDocumentContent(payload.Content, *payload.Type); err != nil {
			return ndrclient.Document{}, fmt.Errorf("invalid content: %w", err)
		}
	}

	// Validate metadata
	if err := ValidateDocumentMetadata(payload.Metadata); err != nil {
		return ndrclient.Document{}, fmt.Errorf("invalid metadata: %w", err)
	}

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

// UnbindDocument removes the binding between a node and a document.
func (s *Service) UnbindDocument(ctx context.Context, meta RequestMeta, nodeID, docID int64) error {
	return s.ndr.UnbindDocument(ctx, toNDRMeta(meta), nodeID, docID)
}

// GetDocument fetches a single document by ID.
func (s *Service) GetDocument(ctx context.Context, meta RequestMeta, docID int64) (ndrclient.Document, error) {
	return s.ndr.GetDocument(ctx, toNDRMeta(meta), docID)
}

// DeleteDocument performs a soft delete on the document.
func (s *Service) DeleteDocument(ctx context.Context, meta RequestMeta, docID int64) error {
	return s.ndr.DeleteDocument(ctx, toNDRMeta(meta), docID)
}

// RestoreDocument restores a previously soft-deleted document.
func (s *Service) RestoreDocument(ctx context.Context, meta RequestMeta, docID int64) (ndrclient.Document, error) {
	return s.ndr.RestoreDocument(ctx, toNDRMeta(meta), docID)
}

// PurgeDocument permanently removes a document.
func (s *Service) PurgeDocument(ctx context.Context, meta RequestMeta, docID int64) error {
	return s.ndr.PurgeDocument(ctx, toNDRMeta(meta), docID)
}

// GetDocumentBindingStatus returns the binding status of a document.
func (s *Service) GetDocumentBindingStatus(ctx context.Context, meta RequestMeta, docID int64) (ndrclient.DocumentBindingStatus, error) {
	return s.ndr.GetDocumentBindingStatus(ctx, toNDRMeta(meta), docID)
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
	// Validate document type if provided
	if payload.Type != nil {
		if !IsValidDocumentType(*payload.Type) {
			return ndrclient.Document{}, fmt.Errorf("invalid document type: %s. Valid types: %v", *payload.Type, ValidDocumentTypes())
		}

		// Validate content structure if both type and content are provided
		if payload.Content != nil {
			if err := ValidateDocumentContent(payload.Content, *payload.Type); err != nil {
				return ndrclient.Document{}, fmt.Errorf("invalid content: %w", err)
			}
		}
	}

	// Validate metadata if provided
	if payload.Metadata != nil {
		if err := ValidateDocumentMetadata(payload.Metadata); err != nil {
			return ndrclient.Document{}, fmt.Errorf("invalid metadata: %w", err)
		}
	}

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

// DocumentVersion represents a version of a document.
type DocumentVersion struct {
	DocumentID    int64          `json:"document_id"`
	VersionNumber int            `json:"version_number"`
	Title         string         `json:"title"`
	Content       map[string]any `json:"content"`
	Metadata      map[string]any `json:"metadata"`
	Type          *string        `json:"type"`
	CreatedBy     string         `json:"created_by"`
	CreatedAt     string         `json:"created_at"`
	ChangeMessage *string        `json:"change_message"`
}

// DocumentVersionsPage wraps paginated version results.
type DocumentVersionsPage struct {
	Page     int               `json:"page"`
	Size     int               `json:"size"`
	Total    int               `json:"total"`
	Versions []DocumentVersion `json:"versions"`
}

// DocumentVersionDiff represents differences between two versions.
type DocumentVersionDiff struct {
	FromVersion int            `json:"from_version"`
	ToVersion   int            `json:"to_version"`
	TitleDiff   *DiffDetail    `json:"title_diff,omitempty"`
	ContentDiff map[string]any `json:"content_diff,omitempty"`
	MetaDiff    map[string]any `json:"metadata_diff,omitempty"`
}

// DiffDetail represents the difference in a specific field.
type DiffDetail struct {
	Old any `json:"old"`
	New any `json:"new"`
}

// ListDocumentVersions retrieves all versions of a document.
func (s *Service) ListDocumentVersions(ctx context.Context, meta RequestMeta, docID int64, page, size int) (DocumentVersionsPage, error) {
	ndrPage, err := s.ndr.ListDocumentVersions(ctx, toNDRMeta(meta), docID, page, size)
	if err != nil {
		return DocumentVersionsPage{}, err
	}

	source := ndrPage.Versions
	if len(source) == 0 && len(ndrPage.Items) > 0 {
		source = ndrPage.Items
	}

	versions := make([]DocumentVersion, 0, len(source))
	for _, v := range source {
		versions = append(versions, DocumentVersion{
			DocumentID:    v.DocumentID,
			VersionNumber: v.VersionNumber,
			Title:         v.Title,
			Content:       v.Content,
			Metadata:      v.Metadata,
			Type:          v.Type,
			CreatedBy:     v.CreatedBy,
			CreatedAt:     v.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			ChangeMessage: v.ChangeMessage,
		})
	}

	return DocumentVersionsPage{
		Page:     ndrPage.Page,
		Size:     ndrPage.Size,
		Total:    ndrPage.Total,
		Versions: versions,
	}, nil
}

// GetDocumentVersion retrieves a specific version of a document.
func (s *Service) GetDocumentVersion(ctx context.Context, meta RequestMeta, docID int64, versionNumber int) (DocumentVersion, error) {
	v, err := s.ndr.GetDocumentVersion(ctx, toNDRMeta(meta), docID, versionNumber)
	if err != nil {
		return DocumentVersion{}, err
	}

	return DocumentVersion{
		DocumentID:    v.DocumentID,
		VersionNumber: v.VersionNumber,
		Title:         v.Title,
		Content:       v.Content,
		Metadata:      v.Metadata,
		Type:          v.Type,
		CreatedBy:     v.CreatedBy,
		CreatedAt:     v.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		ChangeMessage: v.ChangeMessage,
	}, nil
}

// GetDocumentVersionDiff compares two versions of a document.
func (s *Service) GetDocumentVersionDiff(ctx context.Context, meta RequestMeta, docID int64, fromVersion, toVersion int) (DocumentVersionDiff, error) {
	diff, err := s.ndr.GetDocumentVersionDiff(ctx, toNDRMeta(meta), docID, fromVersion, toVersion)
	if err != nil {
		return DocumentVersionDiff{}, err
	}

	return DocumentVersionDiff{
		FromVersion: diff.FromVersion,
		ToVersion:   diff.ToVersion,
		TitleDiff:   (*DiffDetail)(diff.TitleDiff),
		ContentDiff: diff.ContentDiff,
		MetaDiff:    diff.MetaDiff,
	}, nil
}

// RestoreDocumentVersion restores a document to a specific version.
func (s *Service) RestoreDocumentVersion(ctx context.Context, meta RequestMeta, docID int64, versionNumber int) (ndrclient.Document, error) {
	return s.ndr.RestoreDocumentVersion(ctx, toNDRMeta(meta), docID, versionNumber)
}
