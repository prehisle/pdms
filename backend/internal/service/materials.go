package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"

	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// MaterialType 定义资料类型常量
type MaterialType string

const (
	MaterialTypeQuestion   MaterialType = "question"   // 题目
	MaterialTypeOverview   MaterialType = "overview"   // 概览页
	MaterialTypeDictation  MaterialType = "dictation"  // 默写题
	MaterialTypeReference  MaterialType = "reference"  // 参考资料
)

// QuestionType 定义题型常量
type QuestionType string

const (
	QuestionTypeSingleChoice QuestionType = "single_choice"        // 单选题
	QuestionTypeMultiChoice  QuestionType = "multi_choice"         // 多选题
	QuestionTypeMultiBlank   QuestionType = "multi_blank_choice"   // 单题多空单选题
	QuestionTypeFillBlank    QuestionType = "fill_blank"           // 填空题
	QuestionTypeEssay        QuestionType = "essay"                // 简答题
)

// MaterialMetadata 定义资料元数据结构（用于验证）
type MaterialMetadata struct {
	ResourceType   MaterialType   `json:"resource_type"`             // 资料类型
	QuestionType   *QuestionType  `json:"question_type,omitempty"`   // 题型（仅题目类型）
	Difficulty     *int           `json:"difficulty,omitempty"`      // 难度（1-5）
	Tags           []string       `json:"tags,omitempty"`            // 标签
	Options        []QuestionOpt  `json:"options,omitempty"`         // 选项（仅选择题）
	Blanks         []BlankConfig  `json:"blanks,omitempty"`          // 空位配置（仅多空题）
	Answer         any            `json:"answer,omitempty"`          // 答案
	Analysis       *string        `json:"analysis,omitempty"`        // 解析
	ContentFormat  *string        `json:"content_format,omitempty"`  // 内容格式（rich_text/html/markdown）
	TemplateID     *string        `json:"template_id,omitempty"`     // 模板ID（用于概览页等）
}

// QuestionOpt 选项配置
type QuestionOpt struct {
	Key  string `json:"key"`             // 选项标识（A/B/C/D...）
	Text string `json:"text"`            // 选项内容
}

// BlankConfig 空位配置（用于单题多空题）
type BlankConfig struct {
	Index   int    `json:"index"`            // 空位序号
	Hint    string `json:"hint,omitempty"`   // 提示信息
}

// MaterialCreateRequest 创建资料请求
type MaterialCreateRequest struct {
	Title    string                 `json:"title"`
	Content  map[string]any         `json:"content"`          // 题干/正文内容
	Metadata MaterialMetadata       `json:"metadata"`         // 元数据
}

// MaterialUpdateRequest 更新资料请求
type MaterialUpdateRequest struct {
	Title    *string                `json:"title,omitempty"`
	Content  map[string]any         `json:"content,omitempty"`
	Metadata *MaterialMetadata      `json:"metadata,omitempty"`
}

// Material 资料响应结构（包装 Document）
type Material struct {
	ID        int64                  `json:"id"`
	Title     string                 `json:"title"`
	Content   map[string]any         `json:"content"`
	Metadata  MaterialMetadata       `json:"metadata"`
	Type      MaterialType           `json:"type"`
	Position  int                    `json:"position"`
	CreatedBy string                 `json:"created_by"`
	UpdatedBy string                 `json:"updated_by"`
	CreatedAt string                 `json:"created_at"`
	UpdatedAt string                 `json:"updated_at"`
	DeletedAt *string                `json:"deleted_at,omitempty"`
}

// validateMaterialMetadata 验证资料元数据
func validateMaterialMetadata(meta MaterialMetadata) error {
	// 验证资料类型
	switch meta.ResourceType {
	case MaterialTypeQuestion, MaterialTypeOverview, MaterialTypeDictation, MaterialTypeReference:
		// 有效类型
	default:
		return fmt.Errorf("invalid resource_type: %s", meta.ResourceType)
	}

	// 如果是题目类型，必须指定题型
	if meta.ResourceType == MaterialTypeQuestion {
		if meta.QuestionType == nil {
			return errors.New("question_type is required for question materials")
		}

		// 验证题型
		switch *meta.QuestionType {
		case QuestionTypeSingleChoice, QuestionTypeMultiChoice, QuestionTypeMultiBlank, QuestionTypeFillBlank, QuestionTypeEssay:
			// 有效题型
		default:
			return fmt.Errorf("invalid question_type: %s", *meta.QuestionType)
		}

		// 选择题必须有选项
		if *meta.QuestionType == QuestionTypeSingleChoice || *meta.QuestionType == QuestionTypeMultiChoice {
			if len(meta.Options) == 0 {
				return errors.New("options are required for choice questions")
			}
		}

		// 单题多空题必须有空位配置
		if *meta.QuestionType == QuestionTypeMultiBlank {
			if len(meta.Blanks) == 0 {
				return errors.New("blanks configuration is required for multi-blank questions")
			}
		}
	}

	// 验证难度范围
	if meta.Difficulty != nil {
		if *meta.Difficulty < 1 || *meta.Difficulty > 5 {
			return errors.New("difficulty must be between 1 and 5")
		}
	}

	return nil
}

// CreateMaterial 创建资料
func (s *Service) CreateMaterial(ctx context.Context, meta RequestMeta, req MaterialCreateRequest) (Material, error) {
	// 验证元数据
	if err := validateMaterialMetadata(req.Metadata); err != nil {
		return Material{}, fmt.Errorf("invalid metadata: %w", err)
	}

	// 将 MaterialMetadata 转换为 map[string]any
	metadataMap := materialMetadataToMap(req.Metadata)

	// 设置文档类型为资料类型
	typeStr := string(req.Metadata.ResourceType)

	// 创建文档
	doc, err := s.CreateDocument(ctx, meta, DocumentCreateRequest{
		Title:    req.Title,
		Content:  req.Content,
		Metadata: metadataMap,
		Type:     &typeStr,
	})
	if err != nil {
		return Material{}, err
	}

	return documentToMaterial(doc)
}

// UpdateMaterial 更新资料
func (s *Service) UpdateMaterial(ctx context.Context, meta RequestMeta, materialID int64, req MaterialUpdateRequest) (Material, error) {
	// 如果提供了元数据，验证它
	if req.Metadata != nil {
		if err := validateMaterialMetadata(*req.Metadata); err != nil {
			return Material{}, fmt.Errorf("invalid metadata: %w", err)
		}
	}

	// 构建文档更新请求
	docUpdate := DocumentUpdateRequest{
		Title:   req.Title,
		Content: req.Content,
	}

	if req.Metadata != nil {
		metadataMap := materialMetadataToMap(*req.Metadata)
		docUpdate.Metadata = metadataMap

		// 更新文档类型
		typeStr := string(req.Metadata.ResourceType)
		docUpdate.Type = &typeStr
	}

	// 更新文档
	doc, err := s.UpdateDocument(ctx, meta, materialID, docUpdate)
	if err != nil {
		return Material{}, err
	}

	return documentToMaterial(doc)
}

// GetMaterial 获取单个资料
func (s *Service) GetMaterial(ctx context.Context, meta RequestMeta, materialID int64) (Material, error) {
	doc, err := s.ndr.GetDocument(ctx, toNDRMeta(meta), materialID)
	if err != nil {
		return Material{}, err
	}

	return documentToMaterial(doc)
}

// ListMaterials 列出资料（支持按类型筛选）
func (s *Service) ListMaterials(ctx context.Context, meta RequestMeta, query url.Values) ([]Material, int, error) {
	// 获取文档列表
	page, err := s.ListDocuments(ctx, meta, query)
	if err != nil {
		return nil, 0, err
	}

	// 转换为 Material 列表
	materials := make([]Material, 0, len(page.Items))
	for _, doc := range page.Items {
		material, err := documentToMaterial(doc)
		if err != nil {
			// 跳过无法转换的文档
			continue
		}
		materials = append(materials, material)
	}

	return materials, page.Total, nil
}

// DeleteMaterial 删除资料（软删除）
func (s *Service) DeleteMaterial(ctx context.Context, meta RequestMeta, materialID int64) error {
	return s.ndr.DeleteDocument(ctx, toNDRMeta(meta), materialID)
}

// materialMetadataToMap 将 MaterialMetadata 转换为 map
func materialMetadataToMap(meta MaterialMetadata) map[string]any {
	result := make(map[string]any)

	result["resource_type"] = meta.ResourceType

	if meta.QuestionType != nil {
		result["question_type"] = *meta.QuestionType
	}
	if meta.Difficulty != nil {
		result["difficulty"] = *meta.Difficulty
	}
	if len(meta.Tags) > 0 {
		result["tags"] = meta.Tags
	}
	if len(meta.Options) > 0 {
		result["options"] = meta.Options
	}
	if len(meta.Blanks) > 0 {
		result["blanks"] = meta.Blanks
	}
	if meta.Answer != nil {
		result["answer"] = meta.Answer
	}
	if meta.Analysis != nil {
		result["analysis"] = *meta.Analysis
	}
	if meta.ContentFormat != nil {
		result["content_format"] = *meta.ContentFormat
	}
	if meta.TemplateID != nil {
		result["template_id"] = *meta.TemplateID
	}

	return result
}

// documentToMaterial 将 Document 转换为 Material
func documentToMaterial(doc ndrclient.Document) (Material, error) {
	// 解析 metadata 为 MaterialMetadata
	metadata, err := parseMaterialMetadata(doc.Metadata)
	if err != nil {
		return Material{}, fmt.Errorf("parse metadata failed: %w", err)
	}

	// 从 Type 或 metadata 中获取资料类型
	materialType := MaterialTypeQuestion // 默认类型
	if doc.Type != nil {
		materialType = MaterialType(*doc.Type)
	} else if metadata.ResourceType != "" {
		materialType = metadata.ResourceType
	}

	material := Material{
		ID:        doc.ID,
		Title:     doc.Title,
		Content:   doc.Content,
		Metadata:  metadata,
		Type:      materialType,
		Position:  doc.Position,
		CreatedBy: doc.CreatedBy,
		UpdatedBy: doc.UpdatedBy,
		CreatedAt: doc.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt: doc.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}

	if doc.DeletedAt != nil {
		deletedStr := doc.DeletedAt.Format("2006-01-02T15:04:05Z")
		material.DeletedAt = &deletedStr
	}

	return material, nil
}

// parseMaterialMetadata 从 map 解析 MaterialMetadata
func parseMaterialMetadata(m map[string]any) (MaterialMetadata, error) {
	meta := MaterialMetadata{}

	// 解析 resource_type
	if rt, ok := m["resource_type"].(string); ok {
		meta.ResourceType = MaterialType(rt)
	}

	// 解析 question_type
	if qt, ok := m["question_type"].(string); ok {
		qType := QuestionType(qt)
		meta.QuestionType = &qType
	}

	// 解析 difficulty
	if diff, ok := m["difficulty"].(float64); ok {
		d := int(diff)
		meta.Difficulty = &d
	}

	// 解析 tags
	if tags, ok := m["tags"].([]any); ok {
		meta.Tags = make([]string, 0, len(tags))
		for _, t := range tags {
			if s, ok := t.(string); ok {
				meta.Tags = append(meta.Tags, s)
			}
		}
	}

	// 其他字段可以按需解析
	meta.Answer = m["answer"]

	if analysis, ok := m["analysis"].(string); ok {
		meta.Analysis = &analysis
	}
	if format, ok := m["content_format"].(string); ok {
		meta.ContentFormat = &format
	}
	if templateID, ok := m["template_id"].(string); ok {
		meta.TemplateID = &templateID
	}

	return meta, nil
}
