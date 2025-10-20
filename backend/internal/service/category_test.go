package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/yjxt/ydms/backend/internal/cache"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

type fakeNDR struct {
	pingErr      error
	createdNodes []ndrclient.NodeCreate
	updatedNodes []struct {
		ID   int64
		Body ndrclient.NodeUpdate
	}
	deletedNodes  []int64
	restoredNodes []int64
	listResponse  ndrclient.NodesPage
	getNodes      map[int64]ndrclient.Node
	createResp    ndrclient.Node
	updateResp    ndrclient.Node
	restoreResp   ndrclient.Node
	moveResp      ndrclient.Node
	reorderResp   []ndrclient.Node
	reorderErr    error
	reorderInput  *ndrclient.NodeReorderPayload
	listErr       error
	createErr     error
	updateErr     error
	deleteErr     error
	getErr        error
	restoreErr    error
}

func newFakeNDR() *fakeNDR {
	return &fakeNDR{
		getNodes: make(map[int64]ndrclient.Node),
	}
}

func (f *fakeNDR) Ping(context.Context) error {
	return f.pingErr
}

func (f *fakeNDR) CreateNode(_ context.Context, _ ndrclient.RequestMeta, body ndrclient.NodeCreate) (ndrclient.Node, error) {
	f.createdNodes = append(f.createdNodes, body)
	return f.createResp, f.createErr
}

func (f *fakeNDR) GetNode(_ context.Context, _ ndrclient.RequestMeta, id int64, _ ndrclient.GetNodeOptions) (ndrclient.Node, error) {
	if f.getErr != nil {
		return ndrclient.Node{}, f.getErr
	}
	node, ok := f.getNodes[id]
	if !ok {
		return ndrclient.Node{}, errors.New("not found")
	}
	return node, nil
}

func (f *fakeNDR) UpdateNode(_ context.Context, _ ndrclient.RequestMeta, id int64, body ndrclient.NodeUpdate) (ndrclient.Node, error) {
	f.updatedNodes = append(f.updatedNodes, struct {
		ID   int64
		Body ndrclient.NodeUpdate
	}{ID: id, Body: body})
	return f.updateResp, f.updateErr
}

func (f *fakeNDR) DeleteNode(_ context.Context, _ ndrclient.RequestMeta, id int64) error {
	f.deletedNodes = append(f.deletedNodes, id)
	return f.deleteErr
}

func (f *fakeNDR) RestoreNode(_ context.Context, _ ndrclient.RequestMeta, id int64) (ndrclient.Node, error) {
	f.restoredNodes = append(f.restoredNodes, id)
	return f.restoreResp, f.restoreErr
}

func (f *fakeNDR) ListNodes(_ context.Context, _ ndrclient.RequestMeta, _ ndrclient.ListNodesParams) (ndrclient.NodesPage, error) {
	return f.listResponse, f.listErr
}

func (f *fakeNDR) ListChildren(context.Context, ndrclient.RequestMeta, int64, ndrclient.ListChildrenParams) ([]ndrclient.Node, error) {
	return nil, nil
}

func (f *fakeNDR) ReorderNodes(_ context.Context, _ ndrclient.RequestMeta, payload ndrclient.NodeReorderPayload) ([]ndrclient.Node, error) {
	f.reorderInput = &payload
	return f.reorderResp, f.reorderErr
}

func TestCreateCategory(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	fake.createResp = sampleNode(1, "Math", "/math", nil, 1, now, now)
	svc := NewService(cache.NewNoop(), fake)

	cat, err := svc.CreateCategory(context.Background(), RequestMeta{}, CategoryCreateRequest{Name: "Math"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if cat.Name != "Math" || cat.Slug != "math" || cat.Path != "/math" {
		t.Fatalf("unexpected category %+v", cat)
	}
	if len(fake.createdNodes) != 1 {
		t.Fatalf("expected one create call, got %d", len(fake.createdNodes))
	}
}

func TestCreateCategoryRequiresName(t *testing.T) {
	fake := newFakeNDR()
	svc := NewService(cache.NewNoop(), fake)

	if _, err := svc.CreateCategory(context.Background(), RequestMeta{}, CategoryCreateRequest{Name: "  "}); err == nil {
		t.Fatalf("expected error for empty name")
	}
}

func TestUpdateCategory(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	fake.updateResp = sampleNode(2, "Science", "/science", nil, 1, now, now)
	svc := NewService(cache.NewNoop(), fake)

	newName := "Science"
	cat, err := svc.UpdateCategory(context.Background(), RequestMeta{}, 2, CategoryUpdateRequest{Name: &newName})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cat.Slug != "science" {
		t.Fatalf("expected slug science, got %s", cat.Slug)
	}
	if len(fake.updatedNodes) != 1 {
		t.Fatalf("expected update call")
	}
}

func TestGetCategory(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	node := sampleNode(3, "History", "/history", nil, 1, now, now)
	fake.getNodes[3] = node
	svc := NewService(cache.NewNoop(), fake)

	cat, err := svc.GetCategory(context.Background(), RequestMeta{}, 3, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cat.Name != "History" {
		t.Fatalf("unexpected category name %s", cat.Name)
	}
}

func TestDeleteCategory(t *testing.T) {
	fake := newFakeNDR()
	svc := NewService(cache.NewNoop(), fake)

	if err := svc.DeleteCategory(context.Background(), RequestMeta{}, 9); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fake.deletedNodes) != 1 || fake.deletedNodes[0] != 9 {
		t.Fatalf("expected delete call for id 9")
	}
}

func TestRestoreCategory(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	fake.restoreResp = sampleNode(5, "Physics", "/physics", nil, 1, now, now)
	svc := NewService(cache.NewNoop(), fake)

	cat, err := svc.RestoreCategory(context.Background(), RequestMeta{}, 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cat.Name != "Physics" {
		t.Fatalf("unexpected name %s", cat.Name)
	}
}

func TestMoveCategory(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	parent := sampleNode(10, "Root", "/root", nil, 1, now, now)
	child := sampleNode(11, "Child", "/child", ptr[int64](10), 2, now, now)
	fake.getNodes[10] = parent
	fake.updateResp = child
	svc := NewService(cache.NewNoop(), fake)

	cat, err := svc.MoveCategory(context.Background(), RequestMeta{}, 11, MoveCategoryRequest{NewParentID: ptr[int64](10)})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cat.ParentID == nil || *cat.ParentID != 10 {
		t.Fatalf("expected parent id 10")
	}
}

func TestGetCategoryTree(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	fake.listResponse = ndrclient.NodesPage{
		Items: []ndrclient.Node{
			sampleNode(1, "Root", "/root", nil, 1, now, now),
			sampleNode(2, "Child", "/root/child", ptr[int64](1), 1, now, now),
			sampleNode(3, "Other", "/other", nil, 2, now, now),
		},
	}
	svc := NewService(cache.NewNoop(), fake)

	tree, err := svc.GetCategoryTree(context.Background(), RequestMeta{}, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tree) != 2 {
		t.Fatalf("expected 2 root nodes, got %d", len(tree))
	}
	var rootNode *Category
	for _, root := range tree {
		if root.Name == "Root" {
			rootNode = root
			break
		}
	}
	if rootNode == nil {
		t.Fatalf("expected Root node in tree")
	}
	if len(rootNode.Children) != 1 || rootNode.Children[0].Name != "Child" {
		t.Fatalf("expected Root to have Child node")
	}
}

func TestReorderCategories(t *testing.T) {
	fake := newFakeNDR()
	now := time.Now().UTC()
	fake.reorderResp = []ndrclient.Node{
		sampleNode(2, "Child B", "/root/child-b", ptr[int64](1), 2, now, now),
		sampleNode(3, "Child A", "/root/child-a", ptr[int64](1), 1, now, now),
	}
	svc := NewService(cache.NewNoop(), fake)

	parentID := int64(1)
	res, err := svc.ReorderCategories(context.Background(), RequestMeta{}, CategoryReorderRequest{
		ParentID:   &parentID,
		OrderedIDs: []int64{2, 3},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if fake.reorderInput == nil || len(fake.reorderInput.OrderedIDs) != 2 {
		t.Fatalf("expected reorder payload to be captured")
	}
	if len(res) != 2 || res[0].Position != 2 || res[1].Position != 1 {
		t.Fatalf("unexpected reorder result: %+v", res)
	}
}

func sampleNode(id int64, name string, path string, parentID *int64, position int, created, updated time.Time) ndrclient.Node {
	return ndrclient.Node{
		ID:        id,
		Name:      name,
		Slug:      slugify(name),
		Path:      path,
		ParentID:  parentID,
		Position:  position,
		CreatedAt: created,
		UpdatedAt: updated,
	}
}
