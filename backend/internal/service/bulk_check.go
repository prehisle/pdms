package service

import (
	"context"
	"fmt"
	"net/url"

	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// CategoryCheckRequest represents a batch dependency check payload.
type CategoryCheckRequest struct {
	IDs                []int64
	IncludeDescendants bool
}

// CategoryDependencySummary contains aggregated info for delete confirmation.
type CategoryDependencySummary struct {
	ID                 int64    `json:"id"`
	Name               string   `json:"name"`
	Path               string   `json:"path"`
	HasChildren        bool     `json:"has_children"`
	DocumentCount      int      `json:"document_count"`
	IncludeDescendants bool     `json:"include_descendants"`
	Warnings           []string `json:"warnings,omitempty"`
}

// CategoryCheckResponse aggregates dependency results for multiple nodes.
type CategoryCheckResponse struct {
	Items []CategoryDependencySummary `json:"items"`
}

// CheckCategoryDependencies fetches metadata used to confirm bulk delete operations.
func (s *Service) CheckCategoryDependencies(ctx context.Context, meta RequestMeta, req CategoryCheckRequest) (CategoryCheckResponse, error) {
	if len(req.IDs) == 0 {
		return CategoryCheckResponse{}, fmt.Errorf("no category ids provided")
	}

	result := CategoryCheckResponse{Items: make([]CategoryDependencySummary, 0, len(req.IDs))}
	ndrMeta := toNDRMeta(meta)

	query := url.Values{}
	if req.IncludeDescendants {
		query.Set("include_descendants", "true")
	} else {
		query.Set("include_descendants", "false")
	}

	for _, id := range req.IDs {
		node, err := s.ndr.GetNode(ctx, ndrMeta, id, ndrclient.GetNodeOptions{})
		if err != nil {
			return CategoryCheckResponse{}, err
		}

		hasChildren, err := s.ndr.HasChildren(ctx, ndrMeta, id)
		if err != nil {
			return CategoryCheckResponse{}, err
		}

		docs, err := s.ndr.ListNodeDocuments(ctx, ndrMeta, id, query)
		if err != nil {
			return CategoryCheckResponse{}, err
		}

		summary := CategoryDependencySummary{
			ID:                 id,
			Name:               node.Name,
			Path:               node.Path,
			HasChildren:        hasChildren,
			DocumentCount:      len(docs),
			IncludeDescendants: req.IncludeDescendants,
		}

		if hasChildren {
			summary.Warnings = append(summary.Warnings, "包含子节点")
		}
		if summary.DocumentCount > 0 {
			summary.Warnings = append(summary.Warnings, fmt.Sprintf("关联 %d 个文档", summary.DocumentCount))
		}

		result.Items = append(result.Items, summary)
	}

	return result, nil
}
