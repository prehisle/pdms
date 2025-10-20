package ndrclient

import "time"

// Node represents the NDR node resource.
type Node struct {
	ID        int64      `json:"id"`
	Name      string     `json:"name"`
	Slug      string     `json:"slug"`
	Path      string     `json:"path"`
	ParentID  *int64     `json:"parent_id"`
	Position  int        `json:"position"`
	CreatedBy string     `json:"created_by"`
	UpdatedBy string     `json:"updated_by"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at"`
}

// NodeCreate mirrors NDR create payload.
type NodeCreate struct {
	Name       string  `json:"name"`
	Slug       *string `json:"slug,omitempty"`
	ParentPath *string `json:"parent_path,omitempty"`
}

// NodeUpdate mirrors NDR update payload.
type NodeUpdate struct {
	Name       *string `json:"name,omitempty"`
	Slug       *string `json:"slug,omitempty"`
	ParentPath *string `json:"parent_path,omitempty"`
}

// NodeReorderPayload represents the body for batch reordering nodes.
type NodeReorderPayload struct {
	ParentID   *int64  `json:"parent_id"`
	OrderedIDs []int64 `json:"ordered_ids"`
}

// NodesPage wraps paginated node results.
type NodesPage struct {
	Page  int    `json:"page"`
	Size  int    `json:"size"`
	Total int    `json:"total"`
	Items []Node `json:"items"`
}

// ListNodesParams describes optional query params.
type ListNodesParams struct {
	Page           int
	Size           int
	IncludeDeleted *bool
}

// ListChildrenParams describes optional query params for children listing.
type ListChildrenParams struct {
	Depth int
}

// GetNodeOptions describes optional query params for fetching node detail.
type GetNodeOptions struct {
	IncludeDeleted *bool
}
