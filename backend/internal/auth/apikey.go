package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/yjxt/ydms/backend/internal/database"
)

const (
	// APIKeyPrefix API Key 前缀
	APIKeyPrefix = "ydms"
	// APIKeyLength API Key 随机部分长度（字节）
	APIKeyLength = 32
)

// APIKeyAuthMiddleware API Key 认证中间件
// 支持两种方式：
// 1. Authorization: Bearer <api-key>
// 2. X-API-Key: <api-key>
func APIKeyAuthMiddleware(db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 尝试从 Header 获取 API Key
			apiKey := extractAPIKey(r)
			if apiKey == "" {
				respondError(w, http.StatusUnauthorized, errors.New("missing API key"))
				return
			}

			// 验证 API Key 并获取关联用户
			user, err := ValidateAPIKey(db, apiKey)
			if err != nil {
				respondError(w, http.StatusUnauthorized, errors.New("invalid API key: "+err.Error()))
				return
			}

			// 更新最后使用时间（异步，不阻塞请求）
			go updateAPIKeyLastUsed(db, apiKey)

			// 将用户信息存入 context
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// FlexibleAuthMiddleware 灵活的认证中间件
// 同时支持 JWT Token 和 API Key 认证
func FlexibleAuthMiddleware(db *gorm.DB, jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 优先尝试 API Key 认证
			apiKey := extractAPIKey(r)
			if apiKey != "" {
				user, err := ValidateAPIKey(db, apiKey)
				if err == nil {
					// API Key 认证成功
					go updateAPIKeyLastUsed(db, apiKey)
					ctx := context.WithValue(r.Context(), UserContextKey, user)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
				// API Key 无效，返回错误
				respondError(w, http.StatusUnauthorized, errors.New("invalid API key"))
				return
			}

			// 尝试 JWT Token 认证
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				respondError(w, http.StatusUnauthorized, errors.New("missing authorization"))
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				respondError(w, http.StatusUnauthorized, errors.New("invalid authorization header format"))
				return
			}

			tokenString := parts[1]
			claims, err := ValidateToken(tokenString, jwtSecret)
			if err != nil {
				respondError(w, http.StatusUnauthorized, errors.New("invalid token: "+err.Error()))
				return
			}

			// JWT 认证成功
			ctx := context.WithValue(r.Context(), ClaimsContextKey, claims)
			user := &database.User{
				ID:       claims.UserID,
				Username: claims.Username,
				Role:     claims.Role,
			}
			ctx = context.WithValue(ctx, UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// extractAPIKey 从请求中提取 API Key
func extractAPIKey(r *http.Request) string {
	// 1. 尝试从 X-API-Key header 获取
	if apiKey := r.Header.Get("X-API-Key"); apiKey != "" {
		return apiKey
	}

	// 2. 尝试从 Authorization header 获取（Bearer 格式）
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && parts[0] == "Bearer" {
			// 检查是否为 API Key 格式（以 ydms_ 开头）
			if strings.HasPrefix(parts[1], APIKeyPrefix+"_") {
				return parts[1]
			}
		}
	}

	return ""
}

// ValidateAPIKey 验证 API Key 并返回关联的用户
func ValidateAPIKey(db *gorm.DB, apiKey string) (*database.User, error) {
	// 计算 API Key 的哈希值
	keyHash := HashAPIKey(apiKey)

	// 查询数据库（使用 Unscoped 以便能检查已删除的用户）
	var dbKey database.APIKey
	err := db.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Unscoped() // 允许加载已删除的用户，以便进行检查
	}).Where("key_hash = ?", keyHash).First(&dbKey).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("API key not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	// 检查是否已删除
	if dbKey.DeletedAt.Valid {
		return nil, errors.New("API key has been revoked")
	}

	// 检查是否过期
	if dbKey.ExpiresAt != nil && dbKey.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("API key has expired")
	}

	// 检查关联用户是否存在且未删除
	if dbKey.User.DeletedAt.Valid {
		return nil, errors.New("associated user has been deleted")
	}

	return &dbKey.User, nil
}

// updateAPIKeyLastUsed 更新 API Key 的最后使用时间
func updateAPIKeyLastUsed(db *gorm.DB, apiKey string) {
	keyHash := HashAPIKey(apiKey)
	now := time.Now()
	db.Model(&database.APIKey{}).Where("key_hash = ?", keyHash).Update("last_used_at", now)
}

// GenerateAPIKey 生成一个新的 API Key
// 返回格式：ydms_<env>_<base64-random>
func GenerateAPIKey(env string) (string, error) {
	// 生成随机字节
	randomBytes := make([]byte, APIKeyLength)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	// Base64 编码
	encoded := base64.RawURLEncoding.EncodeToString(randomBytes)

	// 构造 API Key: ydms_<env>_<random>
	apiKey := fmt.Sprintf("%s_%s_%s", APIKeyPrefix, env, encoded)
	return apiKey, nil
}

// HashAPIKey 对 API Key 进行哈希
func HashAPIKey(apiKey string) string {
	hash := sha256.Sum256([]byte(apiKey))
	return fmt.Sprintf("%x", hash)
}

// HashAPIKeyBcrypt 使用 bcrypt 对 API Key 进行哈希（备选方案，更安全但更慢）
func HashAPIKeyBcrypt(apiKey string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(apiKey), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash API key: %w", err)
	}
	return string(hash), nil
}

// VerifyAPIKeyBcrypt 验证 bcrypt 哈希的 API Key
func VerifyAPIKeyBcrypt(apiKey, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(apiKey))
	return err == nil
}
