package service

import (
	"errors"
	"time"

	"github.com/yjxt/ydms/backend/internal/auth"
	"github.com/yjxt/ydms/backend/internal/database"
	"gorm.io/gorm"
)

// UserService 用户服务
type UserService struct {
	db *gorm.DB
}

// NewUserService 创建用户服务
func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// Authenticate 用户认证（登录）
func (s *UserService) Authenticate(username, password string) (*database.User, error) {
	var user database.User
	err := s.db.Where("username = ? AND deleted_at IS NULL", username).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid username or password")
		}
		return nil, err
	}

	// 验证密码
	if !auth.CheckPassword(password, user.PasswordHash) {
		return nil, errors.New("invalid username or password")
	}

	return &user, nil
}

// GetUserByID 根据 ID 获取用户
func (s *UserService) GetUserByID(id uint) (*database.User, error) {
	var user database.User
	err := s.db.Where("deleted_at IS NULL").First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByUsername 根据用户名获取用户
func (s *UserService) GetUserByUsername(username string) (*database.User, error) {
	var user database.User
	err := s.db.Where("username = ? AND deleted_at IS NULL", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// CreateUser 创建用户
func (s *UserService) CreateUser(username, password, role string, createdByID *uint) (*database.User, error) {
	// 验证角色
	if role != "super_admin" && role != "course_admin" && role != "proofreader" {
		return nil, errors.New("invalid role")
	}

	// 验证密码强度
	if len(password) < 8 {
		return nil, errors.New("password must be at least 8 characters")
	}

	// 检查用户名是否已存在（排除软删除用户）
	var count int64
	s.db.Model(&database.User{}).Where("username = ?", username).Count(&count)
	if count > 0 {
		return nil, errors.New("username already exists")
	}

	// 加密密码
	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		return nil, err
	}

	// 检查是否存在被软删除的用户，若存在则复活
	var softDeleted database.User
	if err := s.db.Unscoped().Where("username = ?", username).First(&softDeleted).Error; err == nil {
		if softDeleted.DeletedAt.Valid {
			softDeleted.PasswordHash = passwordHash
			softDeleted.Role = role
			softDeleted.DeletedAt = gorm.DeletedAt{}
			softDeleted.CreatedByID = createdByID
			if err := s.db.Unscoped().Save(&softDeleted).Error; err != nil {
				return nil, err
			}
			return &softDeleted, nil
		}
	}

	// 创建用户
	user := &database.User{
		Username:     username,
		PasswordHash: passwordHash,
		Role:         role,
		CreatedByID:  createdByID,
	}

	err = s.db.Create(user).Error
	if err != nil {
		return nil, err
	}

	return user, nil
}

// UpdatePassword 修改密码
func (s *UserService) UpdatePassword(userID uint, newPassword string) error {
	// 验证密码强度
	if len(newPassword) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	// 加密密码
	passwordHash, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}

	// 更新密码
	err = s.db.Model(&database.User{}).Where("id = ?", userID).Update("password_hash", passwordHash).Error
	return err
}

// DeleteUser 删除用户（软删除）
func (s *UserService) DeleteUser(userID uint) error {
	return s.db.Delete(&database.User{}, userID).Error
}

// ListUsers 列出用户
func (s *UserService) ListUsers(role string) ([]*database.User, error) {
	var users []*database.User
	query := s.db.Where("deleted_at IS NULL")

	if role != "" {
		query = query.Where("role = ?", role)
	}

	err := query.Find(&users).Error
	if err != nil {
		return nil, err
	}

	return users, nil
}

// GrantCoursePermission 授予课程权限
func (s *UserService) GrantCoursePermission(userID uint, rootNodeID int64) error {
	// 检查用户是否存在
	_, err := s.GetUserByID(userID)
	if err != nil {
		return err
	}

	// 检查权限是否已存在
	var count int64
	s.db.Model(&database.CoursePermission{}).
		Where("user_id = ? AND root_node_id = ?", userID, rootNodeID).
		Count(&count)

	if count > 0 {
		return nil // 已存在，不需要重复添加
	}

	// 创建权限
	permission := &database.CoursePermission{
		UserID:     userID,
		RootNodeID: rootNodeID,
	}

	return s.db.Create(permission).Error
}

// RevokeCoursePermission 撤销课程权限
func (s *UserService) RevokeCoursePermission(userID uint, rootNodeID int64) error {
	return s.db.Where("user_id = ? AND root_node_id = ?", userID, rootNodeID).
		Delete(&database.CoursePermission{}).Error
}

// GetUserCourses 获取用户的课程权限列表
func (s *UserService) GetUserCourses(userID uint) ([]int64, error) {
	var permissions []database.CoursePermission
	err := s.db.Where("user_id = ?", userID).Find(&permissions).Error
	if err != nil {
		return nil, err
	}

	rootNodeIDs := make([]int64, len(permissions))
	for i, p := range permissions {
		rootNodeIDs[i] = p.RootNodeID
	}

	return rootNodeIDs, nil
}

// HasCoursePermission 检查用户是否有某个课程的权限
func (s *UserService) HasCoursePermission(userID uint, rootNodeID int64) (bool, error) {
	// 先获取用户信息
	user, err := s.GetUserByID(userID)
	if err != nil {
		return false, err
	}

	// 超级管理员有所有课程权限
	if user.Role == "super_admin" {
		return true, nil
	}

	// 检查数据库中的权限记录
	var count int64
	err = s.db.Model(&database.CoursePermission{}).
		Where("user_id = ? AND root_node_id = ?", userID, rootNodeID).
		Count(&count).Error

	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// GenerateToken 为用户生成 JWT token
func (s *UserService) GenerateToken(user *database.User, secret string, expiry time.Duration) (string, error) {
	return auth.GenerateToken(user.ID, user.Username, user.Role, secret, expiry)
}
