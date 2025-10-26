package service

import (
	"context"
	"fmt"

	"github.com/yjxt/ydms/backend/internal/ndrclient"
	"gorm.io/gorm"
)

// PermissionService 权限服务
type PermissionService struct {
	db          *gorm.DB
	userService *UserService
	ndr         ndrclient.Client
}

// NewPermissionService 创建权限服务
func NewPermissionService(db *gorm.DB, userService *UserService, ndr ndrclient.Client) *PermissionService {
	return &PermissionService{
		db:          db,
		userService: userService,
		ndr:         ndr,
	}
}

// DocumentPermission 文档权限
type DocumentPermission struct {
	CanView          bool
	CanCreate        bool
	CanEdit          bool
	CanDelete        bool
	CanPurge         bool
	CanRestoreVersion bool
}

// NodePermission 节点权限
type NodePermission struct {
	CanView   bool
	CanCreate bool
	CanEdit   bool
	CanDelete bool
	CanPurge  bool
	CanMove   bool
}

// GetDocumentPermission 获取用户对文档的权限
func (s *PermissionService) GetDocumentPermission(ctx context.Context, userID uint, role string, nodeID int64) (*DocumentPermission, error) {
	perm := &DocumentPermission{}

	// 超级管理员：全部权限
	if role == "super_admin" {
		perm.CanView = true
		perm.CanCreate = true
		perm.CanEdit = true
		perm.CanDelete = true
		perm.CanPurge = true
		perm.CanRestoreVersion = true
		return perm, nil
	}

	// 获取节点所属的根节点
	rootNodeID, err := s.getRootNodeID(ctx, nodeID)
	if err != nil {
		return perm, err
	}

	// 检查用户是否有该课程权限
	hasPermission, err := s.userService.HasCoursePermission(userID, rootNodeID)
	if err != nil || !hasPermission {
		return perm, nil // 无权限，返回全 false
	}

	// 根据角色设置权限
	switch role {
	case "course_admin":
		perm.CanView = true
		perm.CanCreate = true
		perm.CanEdit = true
		perm.CanDelete = true
		perm.CanPurge = false // 课程管理员不能永久删除
		perm.CanRestoreVersion = true

	case "proofreader":
		perm.CanView = true
		perm.CanCreate = false // ⚠️ 校对员不能创建文档
		perm.CanEdit = true    // ✅ 可以编辑
		perm.CanDelete = false
		perm.CanPurge = false
		perm.CanRestoreVersion = true // ✅ 可以恢复历史版本
	}

	return perm, nil
}

// GetNodePermission 获取用户对节点的权限
func (s *PermissionService) GetNodePermission(ctx context.Context, userID uint, role string, nodeID int64) (*NodePermission, error) {
	perm := &NodePermission{}

	// 超级管理员：全部权限
	if role == "super_admin" {
		perm.CanView = true
		perm.CanCreate = true
		perm.CanEdit = true
		perm.CanDelete = true
		perm.CanPurge = true
		perm.CanMove = true
		return perm, nil
	}

	// 获取节点所属的根节点
	rootNodeID, err := s.getRootNodeID(ctx, nodeID)
	if err != nil {
		return perm, err
	}

	// 检查用户是否有该课程权限
	hasPermission, err := s.userService.HasCoursePermission(userID, rootNodeID)
	if err != nil || !hasPermission {
		return perm, nil // 无权限，返回全 false
	}

	// 根据角色设置权限
	switch role {
	case "course_admin":
		perm.CanView = true
		perm.CanCreate = true
		perm.CanEdit = true
		perm.CanDelete = true
		perm.CanPurge = false // 课程管理员不能永久删除
		perm.CanMove = true

	case "proofreader":
		perm.CanView = true     // ✅ 可以查看
		perm.CanCreate = false  // ❌ 不能创建节点
		perm.CanEdit = false    // ❌ 不能编辑节点
		perm.CanDelete = false  // ❌ 不能删除节点
		perm.CanPurge = false
		perm.CanMove = false
	}

	return perm, nil
}

// CanRestoreDocumentVersion 检查用户是否可以恢复文档版本
func (s *PermissionService) CanRestoreDocumentVersion(ctx context.Context, userID uint, role string, docID int64) (bool, error) {
	// 超级管理员和课程管理员：直接允许
	if role == "super_admin" || role == "course_admin" {
		return true, nil
	}

	// 校对员：检查是否有该文档的编辑权限
	if role == "proofreader" {
		// 获取文档绑定的节点（暂时简化，假设文档有 node_id）
		// 实际应该通过 NDR API 查询关系
		// TODO: 实现完整的文档-节点关系查询
		return true, nil // 暂时允许，后续完善
	}

	return false, nil
}

// getRootNodeID 获取节点所属的根节点 ID
func (s *PermissionService) getRootNodeID(ctx context.Context, nodeID int64) (int64, error) {
	// 调用 NDR API 获取节点信息
	node, err := s.ndr.GetNode(ctx, toNDRMeta(RequestMeta{}), nodeID, ndrclient.GetNodeOptions{})
	if err != nil {
		return 0, fmt.Errorf("failed to get node: %w", err)
	}

	// 如果 ParentID 为 nil，说明是根节点
	if node.ParentID == nil {
		return nodeID, nil
	}

	// 需要递归向上查找根节点
	// 为了简化，暂时假设节点层级不深，直接查询父节点
	// TODO: 优化为一次性获取完整路径
	currentID := *node.ParentID
	for {
		parent, err := s.ndr.GetNode(ctx, toNDRMeta(RequestMeta{}), currentID, ndrclient.GetNodeOptions{})
		if err != nil {
			return 0, fmt.Errorf("failed to get parent node: %w", err)
		}
		if parent.ParentID == nil {
			// 找到根节点
			return parent.ID, nil
		}
		currentID = *parent.ParentID
	}
}

// FilterUserCourses 过滤用户有权限的课程（根节点）
func (s *PermissionService) FilterUserCourses(ctx context.Context, userID uint, role string, allCourses []int64) ([]int64, error) {
	// 超级管理员可以看到所有课程
	if role == "super_admin" {
		return allCourses, nil
	}

	// 获取用户的课程权限
	userCourses, err := s.userService.GetUserCourses(userID)
	if err != nil {
		return nil, err
	}

	// 构建权限映射
	courseMap := make(map[int64]bool)
	for _, courseID := range userCourses {
		courseMap[courseID] = true
	}

	// 过滤
	filtered := []int64{}
	for _, courseID := range allCourses {
		if courseMap[courseID] {
			filtered = append(filtered, courseID)
		}
	}

	return filtered, nil
}

// HasCoursePermission 检查用户是否有某个课程的权限（包装 UserService 的方法）
func (s *PermissionService) HasCoursePermission(userID uint, rootNodeID int64) (bool, error) {
	return s.userService.HasCoursePermission(userID, rootNodeID)
}
