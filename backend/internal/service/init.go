package service

import (
	"errors"

	"github.com/yjxt/ydms/backend/internal/auth"
	"github.com/yjxt/ydms/backend/internal/database"
	"gorm.io/gorm"
)

// InitService 初始化服务
type InitService struct {
	db *gorm.DB
}

// NewInitService 创建初始化服务
func NewInitService(db *gorm.DB) *InitService {
	return &InitService{db: db}
}

// IsInitialized 检查系统是否已初始化（是否存在超级管理员）
func (s *InitService) IsInitialized() (bool, error) {
	var count int64
	err := s.db.Model(&database.User{}).Where("role = ?", "super_admin").Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// InitializeSuperAdmin 初始化超级管理员
func (s *InitService) InitializeSuperAdmin(username, password string) error {
	// 检查是否已初始化
	initialized, err := s.IsInitialized()
	if err != nil {
		return err
	}
	if initialized {
		return errors.New("system already initialized")
	}

	// 验证密码强度
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	// 加密密码
	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	// 创建超级管理员
	superAdmin := &database.User{
		Username:     username,
		PasswordHash: passwordHash,
		Role:         "super_admin",
		DisplayName:  "超级管理员",
	}

	err = s.db.Create(superAdmin).Error
	if err != nil {
		return err
	}

	return nil
}
