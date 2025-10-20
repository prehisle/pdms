package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// Category represents a catalog node exposed by the backend.
type Category struct {
	ID        int64       `json:"id"`
	Name      string      `json:"name"`
	Slug      string      `json:"slug"`
	Path      string      `json:"path"`
	ParentID  *int64      `json:"parent_id,omitempty"`
	Position  int         `json:"position"`
	CreatedAt string      `json:"created_at"`
	UpdatedAt string      `json:"updated_at"`
	DeletedAt *string     `json:"deleted_at,omitempty"`
	Children  []*Category `json:"children,omitempty"`
}

// CategoryCreateRequest captures inputs from API layer.
type CategoryCreateRequest struct {
	Name     string `json:"name"`
	ParentID *int64 `json:"parent_id"`
}

// CategoryUpdateRequest captures editable fields.
type CategoryUpdateRequest struct {
	Name *string `json:"name"`
}

// MoveCategoryRequest describes drag-and-drop operations.
type MoveCategoryRequest struct {
	NewParentID *int64 `json:"new_parent_id"`
}

// CategoryReorderRequest describes a batch reorder request.
type CategoryReorderRequest struct {
	ParentID   *int64  `json:"parent_id"`
	OrderedIDs []int64 `json:"ordered_ids"`
}

// ListCategoriesParams describes filtering options.
type ListCategoriesParams struct {
	IncludeDeleted bool
}

// GetCategory returns a single node by ID.
func (s *Service) GetCategory(ctx context.Context, meta RequestMeta, id int64, includeDeleted bool) (Category, error) {
	var opts ndrclient.GetNodeOptions
	if includeDeleted {
		opts.IncludeDeleted = ptr(true)
	}
	node, err := s.ndr.GetNode(ctx, toNDRMeta(meta), id, opts)
	if err != nil {
		return Category{}, fmt.Errorf("get node: %w", err)
	}
	category := mapNode(node, nil)
	return *category, nil
}

// CreateCategory creates a new node in NDR.
func (s *Service) CreateCategory(ctx context.Context, meta RequestMeta, req CategoryCreateRequest) (Category, error) {
	if strings.TrimSpace(req.Name) == "" {
		return Category{}, errors.New("name is required")
	}

	log.Printf("[category] create name=%q parent_id=%v", req.Name, req.ParentID)

	// TODO: 需要 NDR 支持同级节点唯一约束或返回冲突错误。
	var parentPath *string
	if req.ParentID != nil {
		parent, err := s.ndr.GetNode(ctx, toNDRMeta(meta), *req.ParentID, ndrclient.GetNodeOptions{})
		if err != nil {
			log.Printf("[category] create fetch parent failed id=%d err=%v", *req.ParentID, err)
			return Category{}, fmt.Errorf("fetch parent: %w", err)
		}
		parentPath = &parent.Path
	}

	slug := slugify(req.Name)
	if slug == "" {
		slug = fmt.Sprintf("node-%d", time.Now().UnixNano())
	}
	body := ndrclient.NodeCreate{
		Name:       req.Name,
		Slug:       &slug,
		ParentPath: parentPath,
	}

	node, err := s.ndr.CreateNode(ctx, toNDRMeta(meta), body)
	if err != nil {
		log.Printf("[category] create node failed name=%q err=%v", req.Name, err)
		return Category{}, fmt.Errorf("create node: %w", err)
	}

	category := mapNode(node, req.ParentID)
	log.Printf("[category] created node id=%d path=%s position=%d", category.ID, category.Path, category.Position)
	return *category, nil
}

// UpdateCategory updates mutable node fields.
func (s *Service) UpdateCategory(ctx context.Context, meta RequestMeta, id int64, req CategoryUpdateRequest) (Category, error) {
	if req.Name == nil || strings.TrimSpace(*req.Name) == "" {
		return Category{}, errors.New("name is required")
	}

	log.Printf("[category] update id=%d name=%q", id, strings.TrimSpace(*req.Name))

	// TODO: NDR 缺少 slug 唯一性校验时需在业务层兜底。
	slug := slugify(*req.Name)
	if slug == "" {
		slug = fmt.Sprintf("node-%d", time.Now().UnixNano())
	}
	node, err := s.ndr.UpdateNode(ctx, toNDRMeta(meta), id, ndrclient.NodeUpdate{
		Name: req.Name,
		Slug: &slug,
	})
	if err != nil {
		log.Printf("[category] update node failed id=%d err=%v", id, err)
		return Category{}, fmt.Errorf("update node: %w", err)
	}

	category := mapNode(node, nil)
	log.Printf("[category] updated node id=%d path=%s position=%d", category.ID, category.Path, category.Position)
	return *category, nil
}

// DeleteCategory performs a soft delete in NDR.
func (s *Service) DeleteCategory(ctx context.Context, meta RequestMeta, id int64) error {
	log.Printf("[category] delete id=%d", id)
	if err := s.ndr.DeleteNode(ctx, toNDRMeta(meta), id); err != nil {
		log.Printf("[category] delete node failed id=%d err=%v", id, err)
		return fmt.Errorf("delete node: %w", err)
	}
	return nil
}

// RestoreCategory reactivates a soft-deleted node.
func (s *Service) RestoreCategory(ctx context.Context, meta RequestMeta, id int64) (Category, error) {
	log.Printf("[category] restore id=%d", id)
	node, err := s.ndr.RestoreNode(ctx, toNDRMeta(meta), id)
	if err != nil {
		log.Printf("[category] restore node failed id=%d err=%v", id, err)
		return Category{}, fmt.Errorf("restore node: %w", err)
	}
	category := mapNode(node, nil)
	log.Printf("[category] restored node id=%d path=%s", category.ID, category.Path)
	return *category, nil
}

// MoveCategory changes the parent of a node (drag-and-drop).
func (s *Service) MoveCategory(ctx context.Context, meta RequestMeta, id int64, req MoveCategoryRequest) (Category, error) {
	log.Printf("[category] move id=%d new_parent=%v", id, req.NewParentID)
	var parentPath *string
	if req.NewParentID != nil {
		parent, err := s.ndr.GetNode(ctx, toNDRMeta(meta), *req.NewParentID, ndrclient.GetNodeOptions{})
		if err != nil {
			log.Printf("[category] move fetch parent failed id=%d err=%v", *req.NewParentID, err)
			return Category{}, fmt.Errorf("fetch new parent: %w", err)
		}
		parentPath = &parent.Path
	}

	node, err := s.ndr.UpdateNode(ctx, toNDRMeta(meta), id, ndrclient.NodeUpdate{
		ParentPath: parentPath,
	})
	if err != nil {
		log.Printf("[category] move node failed id=%d err=%v", id, err)
		return Category{}, fmt.Errorf("move node: %w", err)
	}

	category := mapNode(node, req.NewParentID)
	log.Printf("[category] moved node id=%d new_parent=%v position=%d", category.ID, category.ParentID, category.Position)
	return *category, nil
}

// GetCategoryTree aggregates nodes into a hierarchy.
func (s *Service) GetCategoryTree(ctx context.Context, meta RequestMeta, includeDeleted bool) ([]*Category, error) {
	log.Printf("[category] tree include_deleted=%v", includeDeleted)
	params := ndrclient.ListNodesParams{Page: 1, Size: 1000}
	if includeDeleted {
		params.IncludeDeleted = ptr(true)
	}
	if params.Size > 100 {
		params.Size = 100
	}

	page, err := s.ndr.ListNodes(ctx, toNDRMeta(meta), params)
	if err != nil {
		log.Printf("[category] list nodes failed err=%v", err)
		return nil, fmt.Errorf("list nodes: %w", err)
	}
	log.Printf("[category] raw nodes total=%d items=%v", page.Total, page.Items)

	tree := buildTree(page.Items)
	log.Printf("[category] tree result total=%d roots=%d", page.Total, len(tree))
	return tree, nil
}

// GetDeletedCategories returns nodes that are soft deleted.
func (s *Service) GetDeletedCategories(ctx context.Context, meta RequestMeta) ([]Category, error) {
	log.Printf("[category] trash list")
	params := ndrclient.ListNodesParams{Page: 1, Size: 100, IncludeDeleted: ptr(true)}
	page, err := s.ndr.ListNodes(ctx, toNDRMeta(meta), params)
	if err != nil {
		log.Printf("[category] trash list nodes failed err=%v", err)
		return nil, fmt.Errorf("list nodes: %w", err)
	}
	deleted := make([]Category, 0)
	for i := range page.Items {
		node := page.Items[i]
		if node.DeletedAt == nil {
			continue
		}
		cat := mapNode(node, node.ParentID)
		deleted = append(deleted, *cat)
	}
	log.Printf("[category] trash result count=%d", len(deleted))
	return deleted, nil
}

// PurgeCategory permanently deletes a node in NDR.
func (s *Service) PurgeCategory(ctx context.Context, meta RequestMeta, id int64) error {
	log.Printf("[category] purge id=%d", id)
	if err := s.ndr.PurgeNode(ctx, toNDRMeta(meta), id); err != nil {
		log.Printf("[category] purge node failed id=%d err=%v", id, err)
		return fmt.Errorf("purge node: %w", err)
	}
	return nil
}

// ReorderCategories updates the order of sibling nodes.
func (s *Service) ReorderCategories(ctx context.Context, meta RequestMeta, req CategoryReorderRequest) ([]Category, error) {
	if len(req.OrderedIDs) == 0 {
		return nil, errors.New("ordered_ids is required")
	}

	log.Printf("[category] reorder parent=%v ids=%v", req.ParentID, req.OrderedIDs)

	nodes, err := s.ndr.ReorderNodes(ctx, toNDRMeta(meta), ndrclient.NodeReorderPayload{
		ParentID:   req.ParentID,
		OrderedIDs: req.OrderedIDs,
	})
	if err != nil {
		log.Printf("[category] reorder failed parent=%v err=%v", req.ParentID, err)
		return nil, fmt.Errorf("reorder nodes: %w", err)
	}

	categories := make([]Category, 0, len(nodes))
	for i := range nodes {
		cat := mapNode(nodes[i], req.ParentID)
		categories = append(categories, *cat)
	}
	log.Printf("[category] reorder success parent=%v count=%d", req.ParentID, len(categories))
	return categories, nil
}

func buildTree(nodes []ndrclient.Node) []*Category {
	byID := make(map[int64]*Category)
	var roots []*Category

	for i := range nodes {
		node := nodes[i]
		cat := mapNode(node, nil)
		byID[node.ID] = cat
	}

	for id, cat := range byID {
		if cat.ParentID == nil {
			roots = append(roots, cat)
			continue
		}
		parent := byID[*cat.ParentID]
		if parent == nil {
			roots = append(roots, cat)
			continue
		}
		parent.Children = append(parent.Children, cat)
		byID[id] = cat
	}

	sortCategories(roots)
	for _, cat := range byID {
		if len(cat.Children) > 0 {
			sortCategories(cat.Children)
		}
	}

	if len(roots) == 0 {
		return []*Category{}
	}
	return roots
}

func mapNode(node ndrclient.Node, parentID *int64) *Category {
	var deletedAt *string
	if node.DeletedAt != nil {
		formatted := node.DeletedAt.UTC().Format(time.RFC3339)
		deletedAt = &formatted
	}
	created := node.CreatedAt.UTC().Format(time.RFC3339)
	updated := node.UpdatedAt.UTC().Format(time.RFC3339)

	actualParent := node.ParentID
	if parentID != nil {
		actualParent = parentID
	}

	return &Category{
		ID:        node.ID,
		Name:      node.Name,
		Slug:      node.Slug,
		Path:      node.Path,
		ParentID:  actualParent,
		Position:  node.Position,
		CreatedAt: created,
		UpdatedAt: updated,
		DeletedAt: deletedAt,
	}
}

func ptr[T any](v T) *T {
	return &v
}

func sortCategories(list []*Category) {
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].Position == list[j].Position {
			return strings.Compare(list[i].Name, list[j].Name) < 0
		}
		return list[i].Position < list[j].Position
	})
}
