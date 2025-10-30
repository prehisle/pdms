package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/yjxt/ydms/backend/internal/auth"
	"github.com/yjxt/ydms/backend/internal/database"
)

// APIKeyService API Key 管理服务
type APIKeyService struct {
	db *gorm.DB
}

// NewAPIKeyService 创建 API Key 服务实例
func NewAPIKeyService(db *gorm.DB) *APIKeyService {
	return &APIKeyService{db: db}
}

// CreateAPIKeyRequest 创建 API Key 请求
type CreateAPIKeyRequest struct {
	Name        string     `json:"name"`                   // API Key 名称
	UserID      uint       `json:"user_id"`                // 关联用户 ID
	Scopes      []string   `json:"scopes,omitempty"`       // 权限范围
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`   // 过期时间
	Environment string     `json:"environment,omitempty"`  // 环境标识（prod/dev/test）
	CreatedByID uint       `json:"created_by_id"`          // 创建者 ID
}

// CreateAPIKeyResponse 创建 API Key 响应
type CreateAPIKeyResponse struct {
	APIKey    string         `json:"api_key"`    // 完整的 API Key（仅此一次返回）
	KeyPrefix string         `json:"key_prefix"` // API Key 前缀
	KeyInfo   *database.APIKey `json:"key_info"`   // API Key 信息（不含完整密钥）
}

// CreateAPIKey 创建新的 API Key
func (s *APIKeyService) CreateAPIKey(req CreateAPIKeyRequest) (*CreateAPIKeyResponse, error) {
	// 验证用户是否存在
	var user database.User
	if err := s.db.First(&user, req.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("failed to query user: %w", err)
	}

	// 检查用户是否为管理员角色
	if user.Role != "super_admin" && user.Role != "course_admin" {
		return nil, errors.New("API keys can only be created for admin users")
	}

	// 设置默认环境
	env := req.Environment
	if env == "" {
		env = "prod"
	}

	// 生成 API Key
	apiKey, err := auth.GenerateAPIKey(env)
	if err != nil {
		return nil, fmt.Errorf("failed to generate API key: %w", err)
	}

	// 计算哈希值
	keyHash := auth.HashAPIKey(apiKey)

	// 提取前缀（用于显示）
	keyPrefix := extractKeyPrefix(apiKey)

	// 序列化 scopes
	scopesJSON := ""
	if len(req.Scopes) > 0 {
		scopesBytes, err := json.Marshal(req.Scopes)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize scopes: %w", err)
		}
		scopesJSON = string(scopesBytes)
	}

	// 创建数据库记录
	dbKey := database.APIKey{
		Name:        req.Name,
		KeyHash:     keyHash,
		KeyPrefix:   keyPrefix,
		UserID:      req.UserID,
		Scopes:      scopesJSON,
		ExpiresAt:   req.ExpiresAt,
		CreatedByID: req.CreatedByID,
	}

	if err := s.db.Create(&dbKey).Error; err != nil {
		return nil, fmt.Errorf("failed to create API key: %w", err)
	}

	// 重新加载以获取关联数据
	if err := s.db.Preload("User").Preload("CreatedBy").First(&dbKey, dbKey.ID).Error; err != nil {
		return nil, fmt.Errorf("failed to reload API key: %w", err)
	}

	return &CreateAPIKeyResponse{
		APIKey:    apiKey,
		KeyPrefix: keyPrefix,
		KeyInfo:   &dbKey,
	}, nil
}

// ListAPIKeys 列出 API Keys
func (s *APIKeyService) ListAPIKeys(userID uint, includeDeleted bool) ([]database.APIKey, error) {
	var keys []database.APIKey
	query := s.db.Preload("User").Preload("CreatedBy")

	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}

	if !includeDeleted {
		query = query.Where("deleted_at IS NULL")
	} else {
		query = query.Unscoped()
	}

	if err := query.Order("created_at DESC").Find(&keys).Error; err != nil {
		return nil, fmt.Errorf("failed to list API keys: %w", err)
	}

	return keys, nil
}

// GetAPIKey 获取 API Key 详情
func (s *APIKeyService) GetAPIKey(id uint) (*database.APIKey, error) {
	var key database.APIKey
	if err := s.db.Preload("User").Preload("CreatedBy").First(&key, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("API key not found")
		}
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}
	return &key, nil
}

// RevokeAPIKey 撤销（软删除）API Key
func (s *APIKeyService) RevokeAPIKey(id uint) error {
	result := s.db.Delete(&database.APIKey{}, id)
	if result.Error != nil {
		return fmt.Errorf("failed to revoke API key: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("API key not found")
	}
	return nil
}

// DeleteAPIKey 永久删除 API Key
func (s *APIKeyService) DeleteAPIKey(id uint) error {
	result := s.db.Unscoped().Delete(&database.APIKey{}, id)
	if result.Error != nil {
		return fmt.Errorf("failed to delete API key: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("API key not found")
	}
	return nil
}

// UpdateAPIKey 更新 API Key 信息（名称、过期时间等）
func (s *APIKeyService) UpdateAPIKey(id uint, updates map[string]interface{}) (*database.APIKey, error) {
	// 检查是否存在
	var key database.APIKey
	if err := s.db.First(&key, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("API key not found")
		}
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}

	// 更新
	if err := s.db.Model(&key).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update API key: %w", err)
	}

	// 重新加载
	if err := s.db.Preload("User").Preload("CreatedBy").First(&key, id).Error; err != nil {
		return nil, fmt.Errorf("failed to reload API key: %w", err)
	}

	return &key, nil
}

// GetAPIKeyStats 获取 API Key 使用统计
func (s *APIKeyService) GetAPIKeyStats(userID uint) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// 总数
	var total int64
	query := s.db.Model(&database.APIKey{})
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, fmt.Errorf("failed to count total: %w", err)
	}
	stats["total"] = total

	// 活跃数（未删除且未过期）
	var active int64
	activeQuery := s.db.Model(&database.APIKey{}).Where("deleted_at IS NULL")
	if userID > 0 {
		activeQuery = activeQuery.Where("user_id = ?", userID)
	}
	activeQuery = activeQuery.Where("expires_at IS NULL OR expires_at > ?", time.Now())
	if err := activeQuery.Count(&active).Error; err != nil {
		return nil, fmt.Errorf("failed to count active: %w", err)
	}
	stats["active"] = active

	// 已过期数
	var expired int64
	expiredQuery := s.db.Model(&database.APIKey{}).Where("deleted_at IS NULL")
	if userID > 0 {
		expiredQuery = expiredQuery.Where("user_id = ?", userID)
	}
	expiredQuery = expiredQuery.Where("expires_at IS NOT NULL AND expires_at <= ?", time.Now())
	if err := expiredQuery.Count(&expired).Error; err != nil {
		return nil, fmt.Errorf("failed to count expired: %w", err)
	}
	stats["expired"] = expired

	// 已撤销数
	var revoked int64
	revokedQuery := s.db.Unscoped().Model(&database.APIKey{}).Where("deleted_at IS NOT NULL")
	if userID > 0 {
		revokedQuery = revokedQuery.Where("user_id = ?", userID)
	}
	if err := revokedQuery.Count(&revoked).Error; err != nil {
		return nil, fmt.Errorf("failed to count revoked: %w", err)
	}
	stats["revoked"] = revoked

	return stats, nil
}

// extractKeyPrefix 提取 API Key 的显示前缀
// 例如：ydms_prod_abc123... -> ydms_prod_abc1...
func extractKeyPrefix(apiKey string) string {
	if len(apiKey) <= 16 {
		return apiKey
	}
	return apiKey[:16] + "..."
}
