package service

import (
	"context"
	"net/url"
	"testing"
	"time"

	"github.com/yjxt/ydms/backend/internal/cache"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

type bulkCheckFakeNDR struct {
	fakeNDR
	documents map[int64]int
}

func newBulkCheckFakeNDR() *bulkCheckFakeNDR {
	return &bulkCheckFakeNDR{
		fakeNDR:   *newFakeNDR(),
		documents: make(map[int64]int),
	}
}

func sampleTime() time.Time {
	return time.Unix(0, 0).UTC()
}

func (f *bulkCheckFakeNDR) ListNodeDocuments(ctx context.Context, meta ndrclient.RequestMeta, id int64, query url.Values) ([]ndrclient.Document, error) {
	count := f.documents[id]
	docs := make([]ndrclient.Document, 0, count)
	for i := 0; i < count; i++ {
		docs = append(docs, ndrclient.Document{ID: int64(i + 1)})
	}
	return docs, nil
}

func TestCheckCategoryDependencies(t *testing.T) {
	fake := newBulkCheckFakeNDR()
	now := sampleTime()
	parent := sampleNode(1, "Parent", "/parent", nil, 1, now, now)
	childParentID := parent.ID
	child := sampleNode(2, "Child", "/parent/child", &childParentID, 1, now, now)
	fake.getNodes[parent.ID] = parent
	fake.getNodes[child.ID] = child
	fake.documents[parent.ID] = 2

	svc := NewService(cache.NewNoop(), fake)
	resp, err := svc.CheckCategoryDependencies(context.Background(), RequestMeta{}, CategoryCheckRequest{
		IDs:                []int64{parent.ID, child.ID},
		IncludeDescendants: true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(resp.Items))
	}
	if resp.Items[0].ID != parent.ID || resp.Items[0].DocumentCount != 2 {
		t.Fatalf("unexpected parent summary: %+v", resp.Items[0])
	}
	if len(resp.Items[0].Warnings) == 0 {
		t.Fatalf("expected warnings for parent")
	}
}
