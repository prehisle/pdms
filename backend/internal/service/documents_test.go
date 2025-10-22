package service

import (
	"context"
	"testing"
	"time"

	"github.com/yjxt/ydms/backend/internal/cache"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

func TestCreateDocument(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	fake.createDocResp = sampleDocument(1, "Test Doc", "markdown", 1, now, now)
	svc := NewService(cache.NewNoop(), fake)

	docType := "markdown"
	position := 1
	doc, err := svc.CreateDocument(context.Background(), RequestMeta{}, DocumentCreateRequest{
		Title:    "Test Doc",
		Type:     &docType,
		Position: &position,
		Content:  map[string]any{"text": "Hello World"},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if doc.Title != "Test Doc" || doc.Type == nil || *doc.Type != "markdown" {
		t.Fatalf("unexpected document %+v", doc)
	}
	if len(fake.createdDocs) != 1 {
		t.Fatalf("expected one create call, got %d", len(fake.createdDocs))
	}
	created := fake.createdDocs[0]
	if created.Title != "Test Doc" || created.Type == nil || *created.Type != "markdown" {
		t.Fatalf("unexpected created document payload %+v", created)
	}
}

func TestCreateDocumentWithoutType(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	fake.createDocResp = sampleDocument(2, "Plain Doc", "", 1, now, now)
	svc := NewService(cache.NewNoop(), fake)

	doc, err := svc.CreateDocument(context.Background(), RequestMeta{}, DocumentCreateRequest{
		Title:   "Plain Doc",
		Content: map[string]any{"text": "Content"},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if doc.Title != "Plain Doc" {
		t.Fatalf("unexpected document title %s", doc.Title)
	}
	if len(fake.createdDocs) != 1 {
		t.Fatalf("expected one create call, got %d", len(fake.createdDocs))
	}
}

func TestUpdateDocument(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	fake.updateDocResp = sampleDocument(3, "Updated Doc", "html", 2, now, now)
	svc := NewService(cache.NewNoop(), fake)

	newTitle := "Updated Doc"
	newType := "html"
	newPosition := 2
	doc, err := svc.UpdateDocument(context.Background(), RequestMeta{}, 3, DocumentUpdateRequest{
		Title:    &newTitle,
		Type:     &newType,
		Position: &newPosition,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if doc.Title != "Updated Doc" || doc.Type == nil || *doc.Type != "html" {
		t.Fatalf("unexpected updated document %+v", doc)
	}
	if len(fake.updatedDocs) != 1 {
		t.Fatalf("expected update call")
	}
	updated := fake.updatedDocs[0]
	if updated.ID != 3 || updated.Body.Title == nil || *updated.Body.Title != "Updated Doc" {
		t.Fatalf("unexpected update payload %+v", updated)
	}
}

func TestReorderDocuments(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()

	// Setup fake responses for each document update
	doc1 := sampleDocument(10, "Doc A", "markdown", 1, now, now)
	fake.updateDocResp = doc1 // This will be reused for all updates

	svc := NewService(cache.NewNoop(), fake)

	docs, err := svc.ReorderDocuments(context.Background(), RequestMeta{}, DocumentReorderRequest{
		NodeID:     100,
		OrderedIDs: []int64{10, 11},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(docs) != 2 {
		t.Fatalf("expected 2 documents, got %d", len(docs))
	}
	if len(fake.updatedDocs) != 2 {
		t.Fatalf("expected 2 update calls, got %d", len(fake.updatedDocs))
	}

	// Check that positions were set correctly (1-based)
	firstUpdate := fake.updatedDocs[0]
	secondUpdate := fake.updatedDocs[1]

	if firstUpdate.ID != 10 || firstUpdate.Body.Position == nil || *firstUpdate.Body.Position != 1 {
		t.Fatalf("expected first document to have position 1, got %+v", firstUpdate)
	}
	if secondUpdate.ID != 11 || secondUpdate.Body.Position == nil || *secondUpdate.Body.Position != 2 {
		t.Fatalf("expected second document to have position 2, got %+v", secondUpdate)
	}
}

func TestReorderDocumentsEmptyOrderedIDs(t *testing.T) {
	fake := newFakeNDR()
	svc := NewService(cache.NewNoop(), fake)

	_, err := svc.ReorderDocuments(context.Background(), RequestMeta{}, DocumentReorderRequest{
		NodeID:     100,
		OrderedIDs: []int64{},
	})
	if err == nil {
		t.Fatalf("expected error for empty ordered_ids")
	}
	if len(fake.updatedDocs) != 0 {
		t.Fatalf("expected no update calls for invalid request")
	}
}

func sampleDocument(id int64, title string, docType string, position int, created, updated time.Time) ndrclient.Document {
	var typePtr *string
	if docType != "" {
		typePtr = &docType
	}
	return ndrclient.Document{
		ID:        id,
		Title:     title,
		Type:      typePtr,
		Position:  position,
		CreatedAt: created,
		UpdatedAt: updated,
		Content:   map[string]any{},
		Metadata:  map[string]any{},
	}
}

func ptrDoc[T any](v T) *T {
	return &v
}