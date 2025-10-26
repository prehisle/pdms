package service

import (
	"context"
	"errors"

	"github.com/yjxt/ydms/backend/internal/database"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
	"gorm.io/gorm"
)

// CourseService 课程服务
type CourseService struct {
	db          *gorm.DB
	ndr         ndrclient.Client
	userService *UserService
}

// NewCourseService 创建课程服务
func NewCourseService(db *gorm.DB, ndr ndrclient.Client, userService *UserService) *CourseService {
	return &CourseService{
		db:          db,
		ndr:         ndr,
		userService: userService,
	}
}

// CourseCreateRequest 创建课程请求
type CourseCreateRequest struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// CreateCourse 创建课程（在 NDR 中创建根节点）
func (s *CourseService) CreateCourse(ctx context.Context, meta RequestMeta, req CourseCreateRequest) (*ndrclient.Node, error) {
	// 验证输入
	if req.Name == "" {
		return nil, errors.New("course name is required")
	}

	// 准备 slug
	slug := req.Slug
	if slug == "" {
		slug = slugify(req.Name)
	}
	slugPtr := &slug

	// 在 NDR 中创建根节点
	node, err := s.ndr.CreateNode(ctx, toNDRMeta(meta), ndrclient.NodeCreate{
		Name:       req.Name,
		Slug:       slugPtr,
		ParentPath: nil, // 根节点没有父节点
	})

	if err != nil {
		return nil, err
	}

	return &node, nil
}

// ListCourses 列出课程（根据用户权限过滤）
func (s *CourseService) ListCourses(ctx context.Context, meta RequestMeta, userID uint, role string) ([]*ndrclient.Node, error) {
	// 如果是超级管理员，返回所有课程
	if role == "super_admin" {
		// TODO: 实现获取所有根节点的逻辑
		// 目前 NDR API 可能没有直接的"获取所有根节点"接口
		// 可以通过 ListNodes 配合过滤实现
		return []*ndrclient.Node{}, nil
	}

	// 其他角色：只返回有权限的课程
	userCourses, err := s.userService.GetUserCourses(userID)
	if err != nil {
		return nil, err
	}

	// 根据课程 ID 列表获取节点详情
	courses := []*ndrclient.Node{}
	for _, courseID := range userCourses {
		node, err := s.ndr.GetNode(ctx, toNDRMeta(meta), courseID, ndrclient.GetNodeOptions{})
		if err != nil {
			continue // 跳过错误的节点
		}
		courses = append(courses, &node)
	}

	return courses, nil
}

// DeleteCourse 删除课程
func (s *CourseService) DeleteCourse(ctx context.Context, meta RequestMeta, courseID int64) error {
	// 删除 NDR 中的根节点
	err := s.ndr.DeleteNode(ctx, toNDRMeta(meta), courseID)
	if err != nil {
		return err
	}

	// 清理 YDMS 数据库中相关的权限记录
	// 删除所有与该课程相关的权限
	s.db.Where("root_node_id = ?", courseID).Delete(&database.CoursePermission{})

	return nil
}
