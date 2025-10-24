package service

import (
	"context"
	"fmt"
	"net/url"

	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// Relationship 表示节点和文档之间的关系
type Relationship struct {
	NodeID     int64  `json:"node_id"`
	DocumentID int64  `json:"document_id"`
	CreatedBy  string `json:"created_by"`
}

// RelationshipCreateRequest 创建关系请求
type RelationshipCreateRequest struct {
	NodeID     int64 `json:"node_id"`
	DocumentID int64 `json:"document_id"`
}

// BindRelationship 创建节点和文档的绑定关系（支持多对多）
func (s *Service) BindRelationship(ctx context.Context, meta RequestMeta, nodeID, docID int64) (Relationship, error) {
	rel, err := s.ndr.BindRelationship(ctx, toNDRMeta(meta), nodeID, docID)
	if err != nil {
		return Relationship{}, err
	}

	return Relationship{
		NodeID:     rel.NodeID,
		DocumentID: rel.DocumentID,
		CreatedBy:  rel.CreatedBy,
	}, nil
}

// UnbindRelationship 删除节点和文档的绑定关系
func (s *Service) UnbindRelationship(ctx context.Context, meta RequestMeta, nodeID, docID int64) error {
	return s.ndr.UnbindRelationship(ctx, toNDRMeta(meta), nodeID, docID)
}

// ListRelationships 列出关系（可按节点或文档ID筛选）
func (s *Service) ListRelationships(ctx context.Context, meta RequestMeta, nodeID, docID *int64) ([]Relationship, error) {
	rels, err := s.ndr.ListRelationships(ctx, toNDRMeta(meta), nodeID, docID)
	if err != nil {
		return nil, err
	}

	relationships := make([]Relationship, 0, len(rels))
	for _, rel := range rels {
		relationships = append(relationships, Relationship{
			NodeID:     rel.NodeID,
			DocumentID: rel.DocumentID,
			CreatedBy:  rel.CreatedBy,
		})
	}

	return relationships, nil
}

// GetMaterialNodes 获取资料绑定的所有节点
func (s *Service) GetMaterialNodes(ctx context.Context, meta RequestMeta, materialID int64) ([]Category, error) {
	// 获取资料的所有关系
	rels, err := s.ListRelationships(ctx, meta, nil, &materialID)
	if err != nil {
		return nil, err
	}

	if len(rels) == 0 {
		return []Category{}, nil
	}

	// 获取所有相关节点
	categories := make([]Category, 0, len(rels))
	for _, rel := range rels {
		node, err := s.ndr.GetNode(ctx, toNDRMeta(meta), rel.NodeID, ndrclient.GetNodeOptions{})
		if err != nil {
			// 跳过无法获取的节点（可能已删除）
			continue
		}
		cat := mapNode(node, nil)
		categories = append(categories, *cat)
	}

	return categories, nil
}

// GetNodeMaterials 获取节点绑定的所有资料
func (s *Service) GetNodeMaterials(ctx context.Context, meta RequestMeta, nodeID int64, query url.Values) ([]Material, error) {
	// 获取节点的所有关系
	rels, err := s.ListRelationships(ctx, meta, &nodeID, nil)
	if err != nil {
		return nil, err
	}

	if len(rels) == 0 {
		return []Material{}, nil
	}

	// 提取所有文档ID
	docIDs := make([]int64, 0, len(rels))
	for _, rel := range rels {
		docIDs = append(docIDs, rel.DocumentID)
	}

	// 使用文档列表接口批量获取
	if query == nil {
		query = url.Values{}
	}

	// 添加ID筛选
	for _, docID := range docIDs {
		query.Add("id", fmt.Sprintf("%d", docID))
	}

	// 获取文档列表
	materials, _, err := s.ListMaterials(ctx, meta, query)
	if err != nil {
		return nil, err
	}

	return materials, nil
}

// BatchBindMaterial 批量绑定资料到多个节点
func (s *Service) BatchBindMaterial(ctx context.Context, meta RequestMeta, materialID int64, nodeIDs []int64) ([]Relationship, error) {
	if len(nodeIDs) == 0 {
		return []Relationship{}, nil
	}

	relationships := make([]Relationship, 0, len(nodeIDs))
	for _, nodeID := range nodeIDs {
		rel, err := s.BindRelationship(ctx, meta, nodeID, materialID)
		if err != nil {
			// 记录错误但继续处理
			continue
		}
		relationships = append(relationships, rel)
	}

	return relationships, nil
}

// BatchUnbindMaterial 批量解绑资料从多个节点
func (s *Service) BatchUnbindMaterial(ctx context.Context, meta RequestMeta, materialID int64, nodeIDs []int64) error {
	if len(nodeIDs) == 0 {
		return nil
	}

	for _, nodeID := range nodeIDs {
		err := s.UnbindRelationship(ctx, meta, nodeID, materialID)
		if err != nil {
			// 记录错误但继续处理
			continue
		}
	}

	return nil
}
