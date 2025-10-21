package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/yjxt/ydms/backend/internal/cache"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
	"github.com/yjxt/ydms/backend/internal/service"
)

func TestCategoriesEndpoints(t *testing.T) {
	ndr := newInMemoryNDR()
	svc := service.NewService(cache.NewNoop(), ndr)
	handler := NewHandler(svc, HeaderDefaults{
		APIKey:   "test-key",
		UserID:   "tester",
		AdminKey: "admin",
	})
	router := NewRouter(handler)

	root := createCategory(t, router, `{"name":"Root"}`)
	if root.ID == 0 {
		t.Fatalf("expected root category id to be set")
	}
	childPayload := fmt.Sprintf(`{"name":"Child","parent_id":%d}`, root.ID)
	child := createCategory(t, router, childPayload)
	if child.ParentID == nil || *child.ParentID != root.ID {
		t.Fatalf("expected child parent_id to be %d, got %v", root.ID, child.ParentID)
	}

	treeReq := httptest.NewRequest(http.MethodGet, "/api/v1/categories/tree", nil)
	treeRec := httptest.NewRecorder()
	router.ServeHTTP(treeRec, treeReq)
	if treeRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for tree, got %d", treeRec.Code)
	}
	var tree []*service.Category
	if err := json.NewDecoder(treeRec.Body).Decode(&tree); err != nil {
		t.Fatalf("decode tree error: %v", err)
	}
	if len(tree) != 1 || len(tree[0].Children) != 1 {
		t.Fatalf("expected 1 root and 1 child, got %+v", tree)
	}

	reorderPayload := fmt.Sprintf(`{"parent_id":%d,"ordered_ids":[%d]}`, root.ID, child.ID)
	reorderReq := httptest.NewRequest(http.MethodPost, "/api/v1/categories/reorder", strings.NewReader(reorderPayload))
	reorderReq.Header.Set("Content-Type", "application/json")
	reorderRec := httptest.NewRecorder()
	router.ServeHTTP(reorderRec, reorderReq)
	if reorderRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for reorder, got %d", reorderRec.Code)
	}
	var reordered []service.Category
	if err := json.NewDecoder(reorderRec.Body).Decode(&reordered); err != nil {
		t.Fatalf("decode reorder error: %v", err)
	}
	if len(reordered) != 1 || reordered[0].ID != child.ID || reordered[0].Position != 1 {
		t.Fatalf("unexpected reorder response %+v", reordered)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d", child.ID), nil)
	deleteRec := httptest.NewRecorder()
	router.ServeHTTP(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 for delete, got %d", deleteRec.Code)
	}

	trashReq := httptest.NewRequest(http.MethodGet, "/api/v1/categories/trash", nil)
	trashRec := httptest.NewRecorder()
	router.ServeHTTP(trashRec, trashReq)
	if trashRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for trash, got %d", trashRec.Code)
	}
	var trashed []service.Category
	if err := json.NewDecoder(trashRec.Body).Decode(&trashed); err != nil {
		t.Fatalf("decode trash error: %v", err)
	}
	if len(trashed) != 1 || trashed[0].ID != child.ID || trashed[0].DeletedAt == nil {
		t.Fatalf("unexpected trash response %+v", trashed)
	}

	restoreReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/categories/%d/restore", child.ID), nil)
	restoreRec := httptest.NewRecorder()
	router.ServeHTTP(restoreRec, restoreReq)
	if restoreRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for restore, got %d", restoreRec.Code)
	}
	var restored service.Category
	if err := json.NewDecoder(restoreRec.Body).Decode(&restored); err != nil {
		t.Fatalf("decode restore error: %v", err)
	}
	if restored.ID != child.ID || restored.DeletedAt != nil {
		t.Fatalf("unexpected restore response %+v", restored)
	}

	trashAfterRestoreReq := httptest.NewRequest(http.MethodGet, "/api/v1/categories/trash", nil)
	trashAfterRestoreRec := httptest.NewRecorder()
	router.ServeHTTP(trashAfterRestoreRec, trashAfterRestoreReq)
	if trashAfterRestoreRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for trash after restore, got %d", trashAfterRestoreRec.Code)
	}
	var trashAfterRestore []service.Category
	if err := json.NewDecoder(trashAfterRestoreRec.Body).Decode(&trashAfterRestore); err != nil {
		t.Fatalf("decode trash after restore error: %v", err)
	}
	if len(trashAfterRestore) != 0 {
		t.Fatalf("expected empty trash after restore, got %+v", trashAfterRestore)
	}

	deleteAgainReq := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d", child.ID), nil)
	deleteAgainRec := httptest.NewRecorder()
	router.ServeHTTP(deleteAgainRec, deleteAgainReq)
	if deleteAgainRec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 for second delete, got %d", deleteAgainRec.Code)
	}

	purgeReq := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d/purge", child.ID), nil)
	purgeRec := httptest.NewRecorder()
	router.ServeHTTP(purgeRec, purgeReq)
	if purgeRec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 for purge, got %d", purgeRec.Code)
	}

	treeAfterPurgeReq := httptest.NewRequest(http.MethodGet, "/api/v1/categories/tree", nil)
	treeAfterPurgeRec := httptest.NewRecorder()
	router.ServeHTTP(treeAfterPurgeRec, treeAfterPurgeReq)
	if treeAfterPurgeRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for tree after purge, got %d", treeAfterPurgeRec.Code)
	}
	var treeAfterPurge []*service.Category
	if err := json.NewDecoder(treeAfterPurgeRec.Body).Decode(&treeAfterPurge); err != nil {
		t.Fatalf("decode tree after purge error: %v", err)
	}
	if len(treeAfterPurge) != 1 || len(treeAfterPurge[0].Children) != 0 {
		t.Fatalf("expected only root node after purge, got %+v", treeAfterPurge)
	}
}

func TestBulkCheckCategories(t *testing.T) {
	ndr := newInMemoryNDR()
	svc := service.NewService(cache.NewNoop(), ndr)
	handler := NewHandler(svc, HeaderDefaults{})
	router := NewRouter(handler)

	root := createCategory(t, router, `{"name":"Root"}`)
	childPayload := fmt.Sprintf(`{"name":"Child","parent_id":%d}`, root.ID)
	child := createCategory(t, router, childPayload)

	doc, err := ndr.CreateDocument(context.Background(), ndrclient.RequestMeta{}, ndrclient.DocumentCreate{Title: "Doc"})
	if err != nil {
		t.Fatalf("create document error: %v", err)
	}
	if err := ndr.BindDocument(context.Background(), ndrclient.RequestMeta{}, root.ID, doc.ID); err != nil {
		t.Fatalf("bind document error: %v", err)
	}

	reqBody := fmt.Sprintf(`{"ids":[%d,%d],"include_descendants":true}`, root.ID, child.ID)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/categories/bulk/check", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var resp service.CategoryCheckResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response error: %v", err)
	}

	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(resp.Items))
	}
	if resp.Items[0].DocumentCount == 0 {
		t.Fatalf("expected document count for root, got %#v", resp.Items[0])
	}
}

func TestBulkCopyCategoriesEndpoint(t *testing.T) {
    ndr := newInMemoryNDR()
    svc := service.NewService(cache.NewNoop(), ndr)
    handler := NewHandler(svc, HeaderDefaults{})
    router := NewRouter(handler)

    existing := createCategory(t, router, `{"name":"Topic"}`)
    _ = existing
    parent := createCategory(t, router, `{"name":"Parent"}`)
    child := createCategory(t, router, fmt.Sprintf(`{"name":"Topic","parent_id":%d}`, parent.ID))
    createCategory(t, router, fmt.Sprintf(`{"name":"Leaf","parent_id":%d}`, child.ID))

    payload := fmt.Sprintf(`{"source_ids":[%d],"target_parent_id":null}`, child.ID)
    req := httptest.NewRequest(http.MethodPost, "/api/v1/categories/bulk/copy", strings.NewReader(payload))
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()

    router.ServeHTTP(rec, req)

    if rec.Code != http.StatusCreated {
        t.Fatalf("expected 201, got %d", rec.Code)
    }

    var resp struct {
        Items []service.Category `json:"items"`
    }
    if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
        t.Fatalf("decode response error: %v", err)
    }
    if len(resp.Items) != 1 {
        t.Fatalf("expected 1 item, got %d", len(resp.Items))
    }
    copied := resp.Items[0]
    if copied.ParentID != nil {
        t.Fatalf("expected copied parent nil, got %v", copied.ParentID)
    }
    if copied.Name == "Topic" {
        t.Fatalf("expected unique name different from Topic")
    }
    if len(copied.Children) != 1 || copied.Children[0].Name != "Leaf" {
        t.Fatalf("expected child Leaf, got %+v", copied.Children)
    }
}

func TestCategoriesEndpoints_InvalidJSON(t *testing.T) {
	ndr := newInMemoryNDR()
	svc := service.NewService(cache.NewNoop(), ndr)
	handler := NewHandler(svc, HeaderDefaults{})
	router := NewRouter(handler)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/categories", strings.NewReader("{"))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid json, got %d", rec.Code)
	}
}

func TestCategoriesEndpoints_InvalidCategoryID(t *testing.T) {
	ndr := newInMemoryNDR()
	svc := service.NewService(cache.NewNoop(), ndr)
	handler := NewHandler(svc, HeaderDefaults{})
	router := NewRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/categories/not-a-number", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for invalid id, got %d", rec.Code)
	}
}

func TestCategoriesEndpoints_MethodNotAllowed(t *testing.T) {
	ndr := newInMemoryNDR()
	svc := service.NewService(cache.NewNoop(), ndr)
	handler := NewHandler(svc, HeaderDefaults{})
	router := NewRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/categories", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405 for method not allowed, got %d", rec.Code)
	}
}

func TestCategoryRepositionEndpoint(t *testing.T) {
	ndr := newInMemoryNDR()
	svc := service.NewService(cache.NewNoop(), ndr)
	handler := NewHandler(svc, HeaderDefaults{})
	router := NewRouter(handler)

	root := createCategory(t, router, `{"name":"Root"}`)
	targetParent := createCategory(t, router, `{"name":"Target"}`)
	existing := createCategory(t, router, fmt.Sprintf(`{"name":"Existing","parent_id":%d}`, targetParent.ID))
	child := createCategory(t, router, fmt.Sprintf(`{"name":"Child","parent_id":%d}`, root.ID))

	payload := fmt.Sprintf(`{"new_parent_id":%d,"ordered_ids":[%d,%d]}`, targetParent.ID, existing.ID, child.ID)
	req := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/v1/categories/%d/reposition", child.ID), strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for reposition, got %d body=%s", rec.Code, rec.Body.String())
	}
	var result service.CategoryRepositionResult
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("decode reposition result error: %v", err)
	}
	if result.Category.ParentID == nil || *result.Category.ParentID != targetParent.ID {
		t.Fatalf("expected child parent to be %d, got %+v", targetParent.ID, result.Category.ParentID)
	}
	if len(result.Siblings) != 2 || result.Siblings[0].ID != existing.ID || result.Siblings[1].ID != child.ID {
		t.Fatalf("unexpected siblings response %+v", result.Siblings)
	}

	treeReq := httptest.NewRequest(http.MethodGet, "/api/v1/categories/tree", nil)
	treeRec := httptest.NewRecorder()
	router.ServeHTTP(treeRec, treeReq)
	if treeRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for tree, got %d", treeRec.Code)
	}
	var tree []*service.Category
	if err := json.NewDecoder(treeRec.Body).Decode(&tree); err != nil {
		t.Fatalf("decode tree error: %v", err)
	}
	var target *service.Category
	for _, node := range tree {
		if node.ID == targetParent.ID {
			target = node
			break
		}
	}
	if target == nil || len(target.Children) != 2 {
		t.Fatalf("expected target parent to have 2 children, got %+v", target)
	}
	if target.Children[1].ID != child.ID {
		t.Fatalf("expected child to be under target parent, got %+v", target.Children)
	}
}

func TestCategoryBulkEndpoints(t *testing.T) {
	ndr := newInMemoryNDR()
	svc := service.NewService(cache.NewNoop(), ndr)
	handler := NewHandler(svc, HeaderDefaults{})
	router := NewRouter(handler)

	root := createCategory(t, router, `{"name":"BulkRoot"}`)
	childA := createCategory(t, router, fmt.Sprintf(`{"name":"A","parent_id":%d}`, root.ID))
	childB := createCategory(t, router, fmt.Sprintf(`{"name":"B","parent_id":%d}`, root.ID))

	deleteReqA := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d", childA.ID), nil)
	deleteRecA := httptest.NewRecorder()
	router.ServeHTTP(deleteRecA, deleteReqA)
	if deleteRecA.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for delete A, got %d", deleteRecA.Code)
	}
	deleteReqB := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d", childB.ID), nil)
	deleteRecB := httptest.NewRecorder()
	router.ServeHTTP(deleteRecB, deleteReqB)
	if deleteRecB.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for delete B, got %d", deleteRecB.Code)
	}

	trashReq := httptest.NewRequest(http.MethodGet, "/api/v1/categories/trash", nil)
	trashRec := httptest.NewRecorder()
	router.ServeHTTP(trashRec, trashReq)
	if trashRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for trash, got %d", trashRec.Code)
	}
	var trashItems []service.Category
	if err := json.NewDecoder(trashRec.Body).Decode(&trashItems); err != nil {
		t.Fatalf("decode trash error: %v", err)
	}
	if len(trashItems) != 2 {
		t.Fatalf("expected 2 items in trash, got %d", len(trashItems))
	}

	restorePayload := fmt.Sprintf(`{"ids":[%d,%d]}`, childA.ID, childB.ID)
	restoreReq := httptest.NewRequest(http.MethodPost, "/api/v1/categories/bulk/restore", strings.NewReader(restorePayload))
	restoreReq.Header.Set("Content-Type", "application/json")
	restoreRec := httptest.NewRecorder()
	router.ServeHTTP(restoreRec, restoreReq)
	if restoreRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for bulk restore, got %d", restoreRec.Code)
	}
	var restoreItems []service.Category
	if err := json.NewDecoder(restoreRec.Body).Decode(&restoreItems); err != nil {
		t.Fatalf("decode restore response error: %v", err)
	}
	if len(restoreItems) != 2 {
		t.Fatalf("expected 2 restored items, got %v", restoreItems)
	}

	deleteReqA = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d", childA.ID), nil)
	deleteRecA = httptest.NewRecorder()
	router.ServeHTTP(deleteRecA, deleteReqA)
	deleteReqB = httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d", childB.ID), nil)
	deleteRecB = httptest.NewRecorder()
	router.ServeHTTP(deleteRecB, deleteReqB)

	purgePayload := fmt.Sprintf(`{"ids":[%d,%d]}`, childA.ID, childB.ID)
	purgeReq := httptest.NewRequest(http.MethodPost, "/api/v1/categories/bulk/purge", strings.NewReader(purgePayload))
	purgeReq.Header.Set("Content-Type", "application/json")
	purgeRec := httptest.NewRecorder()
	router.ServeHTTP(purgeRec, purgeReq)
	if purgeRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 for bulk purge, got %d", purgeRec.Code)
	}
	var purgeResp struct {
		PurgedIDs []int64 `json:"purged_ids"`
	}
	if err := json.NewDecoder(purgeRec.Body).Decode(&purgeResp); err != nil {
		t.Fatalf("decode purge response error: %v", err)
	}
	if len(purgeResp.PurgedIDs) != 2 {
		t.Fatalf("expected 2 purged ids, got %v", purgeResp.PurgedIDs)
	}
}

func createCategory(t *testing.T, router http.Handler, payload string) service.Category {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/categories", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d body=%s", rec.Code, rec.Body.String())
	}
	var cat service.Category
	if err := json.NewDecoder(rec.Body).Decode(&cat); err != nil {
		t.Fatalf("decode category error: %v", err)
	}
	return cat
}

type inMemoryNDR struct {
	nextID     int64
	nextDocID  int64
	nodes      map[int64]ndrclient.Node
	pathIndex  map[string]int64
	childOrder map[int64][]int64
	clock      int64
	documents  map[int64]ndrclient.Document
	bindings   map[int64]map[int64]struct{}
}

func newInMemoryNDR() *inMemoryNDR {
	return &inMemoryNDR{
		nextID:     1,
		nextDocID:  1,
		nodes:      make(map[int64]ndrclient.Node),
		pathIndex:  make(map[string]int64),
		childOrder: make(map[int64][]int64),
		documents:  make(map[int64]ndrclient.Document),
		bindings:   make(map[int64]map[int64]struct{}),
	}
}

func (f *inMemoryNDR) Ping(context.Context) error {
	return nil
}

func (f *inMemoryNDR) CreateNode(ctx context.Context, meta ndrclient.RequestMeta, body ndrclient.NodeCreate) (ndrclient.Node, error) {
	if body.Slug == nil || *body.Slug == "" {
		return ndrclient.Node{}, fmt.Errorf("slug is required")
	}
	id := f.nextID
	f.nextID++

	var parentID *int64
	if body.ParentPath != nil && *body.ParentPath != "" {
		parentPath := strings.TrimRight(*body.ParentPath, "/")
		if pid, ok := f.pathIndex[parentPath]; ok {
			parentID = &pid
		} else {
			return ndrclient.Node{}, fmt.Errorf("unknown parent path %s", parentPath)
		}
	}
	node := ndrclient.Node{
		ID:        id,
		Name:      body.Name,
		Slug:      *body.Slug,
		Path:      f.composePath(parentID, *body.Slug),
		ParentID:  parentID,
		Position:  f.appendChild(parentID, id),
		CreatedAt: f.tick(),
		UpdatedAt: f.tick(),
	}
	f.nodes[id] = node
	f.pathIndex[node.Path] = id
	return node, nil
}

func (f *inMemoryNDR) GetNode(ctx context.Context, meta ndrclient.RequestMeta, id int64, opts ndrclient.GetNodeOptions) (ndrclient.Node, error) {
	node, ok := f.nodes[id]
	if !ok {
		return ndrclient.Node{}, fmt.Errorf("node %d not found", id)
	}
	return node, nil
}

func (f *inMemoryNDR) UpdateNode(ctx context.Context, meta ndrclient.RequestMeta, id int64, body ndrclient.NodeUpdate) (ndrclient.Node, error) {
	node, ok := f.nodes[id]
	if !ok {
		return ndrclient.Node{}, fmt.Errorf("node %d not found", id)
	}
	if body.Name != nil && strings.TrimSpace(*body.Name) != "" {
		node.Name = *body.Name
	}
	if body.Slug != nil && strings.TrimSpace(*body.Slug) != "" {
		node.Slug = *body.Slug
	}
	if value, ok := body.ParentPath.Value(); ok {
		var parentID *int64
		if value != nil {
			parentPath := strings.TrimSpace(*value)
			if parentPath != "" {
				parentPath = strings.TrimRight(parentPath, "/")
				if pid, ok := f.pathIndex[parentPath]; ok {
					parentID = &pid
				} else {
					return ndrclient.Node{}, fmt.Errorf("unknown parent path %s", parentPath)
				}
			}
		}
		f.moveChild(node.ParentID, parentID, id)
		node.ParentID = parentID
	}
	oldPath := node.Path
	node.Path = f.composePath(node.ParentID, node.Slug)
	node.UpdatedAt = f.tick()
	f.nodes[id] = node
	delete(f.pathIndex, oldPath)
	f.pathIndex[node.Path] = id
	return node, nil
}

func (f *inMemoryNDR) DeleteNode(ctx context.Context, meta ndrclient.RequestMeta, id int64) error {
	node, ok := f.nodes[id]
	if !ok {
		return fmt.Errorf("node %d not found", id)
	}
	ts := f.tick()
	node.DeletedAt = &ts
	node.UpdatedAt = ts
	f.nodes[id] = node
	return nil
}

func (f *inMemoryNDR) RestoreNode(ctx context.Context, meta ndrclient.RequestMeta, id int64) (ndrclient.Node, error) {
	node, ok := f.nodes[id]
	if !ok {
		return ndrclient.Node{}, fmt.Errorf("node %d not found", id)
	}
	node.DeletedAt = nil
	node.UpdatedAt = f.tick()
	f.nodes[id] = node
	return node, nil
}

func (f *inMemoryNDR) ListNodes(ctx context.Context, meta ndrclient.RequestMeta, params ndrclient.ListNodesParams) (ndrclient.NodesPage, error) {
	includeDeleted := params.IncludeDeleted != nil && *params.IncludeDeleted
	items := make([]ndrclient.Node, 0, len(f.nodes))
	for _, node := range f.nodes {
		if node.DeletedAt != nil && !includeDeleted {
			continue
		}
		items = append(items, node)
	}
	return ndrclient.NodesPage{
		Page:  params.Page,
		Size:  params.Size,
		Total: len(items),
		Items: items,
	}, nil
}

func (f *inMemoryNDR) ListChildren(ctx context.Context, meta ndrclient.RequestMeta, id int64, params ndrclient.ListChildrenParams) ([]ndrclient.Node, error) {
	children := f.childOrder[id]
	result := make([]ndrclient.Node, 0, len(children))
	for _, childID := range children {
		if node, ok := f.nodes[childID]; ok {
			result = append(result, node)
		}
	}
	return result, nil
}

func (f *inMemoryNDR) HasChildren(ctx context.Context, meta ndrclient.RequestMeta, id int64) (bool, error) {
	kids, err := f.ListChildren(ctx, meta, id, ndrclient.ListChildrenParams{})
	if err != nil {
		return false, err
	}
	return len(kids) > 0, nil
}

func (f *inMemoryNDR) ReorderNodes(ctx context.Context, meta ndrclient.RequestMeta, payload ndrclient.NodeReorderPayload) ([]ndrclient.Node, error) {
	key := int64(0)
	if payload.ParentID != nil {
		key = *payload.ParentID
	}
	f.childOrder[key] = append([]int64(nil), payload.OrderedIDs...)
	result := make([]ndrclient.Node, 0, len(payload.OrderedIDs))
	for idx, id := range payload.OrderedIDs {
		node, ok := f.nodes[id]
		if !ok {
			return nil, fmt.Errorf("node %d not found", id)
		}
		node.Position = idx + 1
		node.UpdatedAt = f.tick()
		f.nodes[id] = node
		result = append(result, node)
	}
	return result, nil
}

func (f *inMemoryNDR) PurgeNode(ctx context.Context, meta ndrclient.RequestMeta, id int64) error {
	node, ok := f.nodes[id]
	if !ok {
		return fmt.Errorf("node %d not found", id)
	}
	key := int64(0)
	if node.ParentID != nil {
		key = *node.ParentID
	}
	f.removeChild(key, id)
	delete(f.pathIndex, node.Path)
	delete(f.nodes, id)
	return nil
}

func (f *inMemoryNDR) ListDocuments(ctx context.Context, meta ndrclient.RequestMeta, query url.Values) (ndrclient.DocumentsPage, error) {
	items := make([]ndrclient.Document, 0, len(f.documents))
	for _, doc := range f.documents {
		items = append(items, doc)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return ndrclient.DocumentsPage{
		Page:  1,
		Size:  len(items),
		Total: len(items),
		Items: items,
	}, nil
}

func (f *inMemoryNDR) ListNodeDocuments(ctx context.Context, meta ndrclient.RequestMeta, nodeID int64, query url.Values) ([]ndrclient.Document, error) {
	includeDescendants := true
	if query != nil {
		if val := strings.ToLower(strings.TrimSpace(query.Get("include_descendants"))); val != "" {
			includeDescendants = !(val == "false" || val == "0")
		}
	}

	targetIDs := []int64{nodeID}
	if includeDescendants {
		for idx := 0; idx < len(targetIDs); idx++ {
			current := targetIDs[idx]
			children := f.childOrder[current]
			targetIDs = append(targetIDs, children...)
		}
	}

	seen := make(map[int64]struct{})
	docs := []ndrclient.Document{}
	for _, nid := range targetIDs {
		binding := f.bindings[nid]
		if binding == nil {
			continue
		}
		for docID := range binding {
			if _, ok := seen[docID]; ok {
				continue
			}
			if doc, ok := f.documents[docID]; ok {
				docs = append(docs, doc)
				seen[docID] = struct{}{}
			}
		}
	}
	sort.Slice(docs, func(i, j int) bool { return docs[i].ID < docs[j].ID })
	return docs, nil
}

func (f *inMemoryNDR) CreateDocument(ctx context.Context, meta ndrclient.RequestMeta, body ndrclient.DocumentCreate) (ndrclient.Document, error) {
	id := f.nextDocID
	f.nextDocID++
	createdAt := f.tick()
	updatedAt := f.tick()
	metadata := map[string]any{}
	if body.Metadata != nil {
		for k, v := range body.Metadata {
			metadata[k] = v
		}
	}
	content := map[string]any{}
	if body.Content != nil {
		for k, v := range body.Content {
			content[k] = v
		}
	}
	doc := ndrclient.Document{
		ID:        id,
		Title:     body.Title,
		Metadata:  metadata,
		Content:   content,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
		CreatedBy: "tester",
		UpdatedBy: "tester",
	}
	f.documents[id] = doc
	return doc, nil
}

func (f *inMemoryNDR) BindDocument(ctx context.Context, meta ndrclient.RequestMeta, nodeID, docID int64) error {
	if _, ok := f.documents[docID]; !ok {
		return fmt.Errorf("document %d not found", docID)
	}
	if f.bindings[nodeID] == nil {
		f.bindings[nodeID] = make(map[int64]struct{})
	}
	f.bindings[nodeID][docID] = struct{}{}
	return nil
}

func (f *inMemoryNDR) composePath(parentID *int64, slug string) string {
	if parentID == nil {
		return "/" + slug
	}
	parent, ok := f.nodes[*parentID]
	if !ok {
		return "/" + slug
	}
	return strings.TrimRight(parent.Path, "/") + "/" + slug
}

func (f *inMemoryNDR) appendChild(parentID *int64, id int64) int {
	key := int64(0)
	if parentID != nil {
		key = *parentID
	}
	f.childOrder[key] = append(f.childOrder[key], id)
	return len(f.childOrder[key])
}

func (f *inMemoryNDR) moveChild(oldParent, newParent *int64, id int64) {
	oldKey := int64(0)
	if oldParent != nil {
		oldKey = *oldParent
	}
	newKey := int64(0)
	if newParent != nil {
		newKey = *newParent
	}
	f.removeChild(oldKey, id)
	f.childOrder[newKey] = append(f.childOrder[newKey], id)
}

func (f *inMemoryNDR) removeChild(parentKey int64, id int64) {
	children := f.childOrder[parentKey]
	for idx, childID := range children {
		if childID == id {
			f.childOrder[parentKey] = append(children[:idx], children[idx+1:]...)
			break
		}
	}
}

func (f *inMemoryNDR) tick() time.Time {
	f.clock++
	return time.Unix(0, f.clock*int64(time.Millisecond)).UTC()
}
