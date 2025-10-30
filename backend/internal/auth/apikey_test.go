package auth

import (
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/yjxt/ydms/backend/internal/database"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	// 自动迁移
	if err := db.AutoMigrate(&database.User{}, &database.APIKey{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	return db
}

func TestGenerateAPIKey(t *testing.T) {
	tests := []struct {
		name string
		env  string
	}{
		{"prod environment", "prod"},
		{"dev environment", "dev"},
		{"test environment", "test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiKey, err := GenerateAPIKey(tt.env)
			if err != nil {
				t.Errorf("GenerateAPIKey() error = %v", err)
				return
			}

			// 检查格式
			prefix := APIKeyPrefix + "_" + tt.env + "_"
			if len(apiKey) < len(prefix)+10 {
				t.Errorf("API key too short: %s", apiKey)
			}

			// 检查前缀
			if apiKey[:len(prefix)] != prefix {
				t.Errorf("API key prefix mismatch, got %s, want %s", apiKey[:len(prefix)], prefix)
			}

			// 生成的每个 key 应该是唯一的
			apiKey2, err := GenerateAPIKey(tt.env)
			if err != nil {
				t.Errorf("GenerateAPIKey() second call error = %v", err)
				return
			}
			if apiKey == apiKey2 {
				t.Errorf("GenerateAPIKey() generated duplicate keys")
			}
		})
	}
}

func TestHashAPIKey(t *testing.T) {
	apiKey := "ydms_prod_test123456"

	hash1 := HashAPIKey(apiKey)
	hash2 := HashAPIKey(apiKey)

	// 相同的输入应该产生相同的哈希
	if hash1 != hash2 {
		t.Errorf("HashAPIKey() inconsistent, got %s and %s", hash1, hash2)
	}

	// 不同的输入应该产生不同的哈希
	differentKey := "ydms_prod_different"
	hash3 := HashAPIKey(differentKey)
	if hash1 == hash3 {
		t.Errorf("HashAPIKey() produced same hash for different keys")
	}

	// 哈希应该是 64 个十六进制字符（SHA256）
	if len(hash1) != 64 {
		t.Errorf("HashAPIKey() produced hash with wrong length: %d", len(hash1))
	}
}

func TestValidateAPIKey(t *testing.T) {
	db := setupTestDB(t)

	// 创建测试用户
	user := database.User{
		Username:     "testuser",
		PasswordHash: "hash",
		Role:         "course_admin",
		DisplayName:  "Test User",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// 生成 API Key
	apiKey, err := GenerateAPIKey("test")
	if err != nil {
		t.Fatalf("failed to generate API key: %v", err)
	}

	// 创建 API Key 记录
	keyHash := HashAPIKey(apiKey)
	dbKey := database.APIKey{
		Name:        "Test Key",
		KeyHash:     keyHash,
		KeyPrefix:   "ydms_test_...",
		UserID:      user.ID,
		CreatedByID: user.ID,
	}
	if err := db.Create(&dbKey).Error; err != nil {
		t.Fatalf("failed to create API key: %v", err)
	}

	tests := []struct {
		name    string
		apiKey  string
		wantErr bool
	}{
		{
			name:    "valid API key",
			apiKey:  apiKey,
			wantErr: false,
		},
		{
			name:    "invalid API key",
			apiKey:  "ydms_test_invalid",
			wantErr: true,
		},
		{
			name:    "empty API key",
			apiKey:  "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotUser, err := ValidateAPIKey(db, tt.apiKey)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAPIKey() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && gotUser == nil {
				t.Errorf("ValidateAPIKey() returned nil user for valid key")
			}
			if !tt.wantErr && gotUser.ID != user.ID {
				t.Errorf("ValidateAPIKey() returned wrong user, got ID %d, want %d", gotUser.ID, user.ID)
			}
		})
	}
}

func TestValidateAPIKey_Expired(t *testing.T) {
	db := setupTestDB(t)

	// 创建测试用户
	user := database.User{
		Username:     "testuser",
		PasswordHash: "hash",
		Role:         "course_admin",
		DisplayName:  "Test User",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// 生成过期的 API Key
	apiKey, _ := GenerateAPIKey("test")
	keyHash := HashAPIKey(apiKey)
	expiredTime := time.Now().Add(-24 * time.Hour)

	dbKey := database.APIKey{
		Name:        "Expired Key",
		KeyHash:     keyHash,
		KeyPrefix:   "ydms_test_...",
		UserID:      user.ID,
		ExpiresAt:   &expiredTime,
		CreatedByID: user.ID,
	}
	if err := db.Create(&dbKey).Error; err != nil {
		t.Fatalf("failed to create API key: %v", err)
	}

	// 验证过期的 key 应该失败
	_, err := ValidateAPIKey(db, apiKey)
	if err == nil {
		t.Errorf("ValidateAPIKey() should fail for expired key")
	}
}

func TestValidateAPIKey_DeletedUser(t *testing.T) {
	db := setupTestDB(t)

	// 创建测试用户
	user := database.User{
		Username:     "testuser",
		PasswordHash: "hash",
		Role:         "course_admin",
		DisplayName:  "Test User",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// 生成 API Key
	apiKey, _ := GenerateAPIKey("test")
	keyHash := HashAPIKey(apiKey)

	dbKey := database.APIKey{
		Name:        "Test Key",
		KeyHash:     keyHash,
		KeyPrefix:   "ydms_test_...",
		UserID:      user.ID,
		CreatedByID: user.ID,
	}
	if err := db.Create(&dbKey).Error; err != nil {
		t.Fatalf("failed to create API key: %v", err)
	}

	// 软删除用户
	if err := db.Delete(&user).Error; err != nil {
		t.Fatalf("failed to delete user: %v", err)
	}

	// 验证关联已删除用户的 key 应该失败
	_, err := ValidateAPIKey(db, apiKey)
	if err == nil {
		t.Errorf("ValidateAPIKey() should fail for deleted user")
	}
}

func TestExtractAPIKey(t *testing.T) {
	// 注意：extractAPIKey 是包私有函数，这里仅作为示例
	// 实际使用时应该通过公共 API 测试
	t.Skip("extractAPIKey is a private function, test through public APIs instead")
}
