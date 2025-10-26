package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/yjxt/ydms/backend/internal/auth"
	"github.com/yjxt/ydms/backend/internal/database"
	"github.com/yjxt/ydms/backend/internal/service"
)

// CourseHandler 课程管理 handler
type CourseHandler struct {
	courseService *service.CourseService
}

// NewCourseHandler 创建课程管理 handler
func NewCourseHandler(courseService *service.CourseService) *CourseHandler {
	return &CourseHandler{courseService: courseService}
}

// ListCourses 列出课程
// GET /api/v1/courses
func (h *CourseHandler) ListCourses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 获取当前用户
	user, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 获取请求元数据
	meta := service.RequestMeta{
		APIKey:    r.Header.Get("x-api-key"),
		UserID:    user.Username,
		RequestID: r.Header.Get("x-request-id"),
	}

	// 列出课程（根据用户权限过滤）
	courses, err := h.courseService.ListCourses(r.Context(), meta, user.ID, user.Role)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"courses": courses,
	})
}

// CreateCourse 创建课程
// POST /api/v1/courses
func (h *CourseHandler) CreateCourse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 获取当前用户
	user, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 只有超级管理员可以创建课程
	if user.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super admin can create courses"))
		return
	}

	// 解析请求
	var req service.CourseCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	// 获取请求元数据
	meta := service.RequestMeta{
		APIKey:    r.Header.Get("x-api-key"),
		UserID:    user.Username,
		RequestID: r.Header.Get("x-request-id"),
	}

	// 创建课程
	course, err := h.courseService.CreateCourse(r.Context(), meta, req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"course": course,
	})
}

// DeleteCourse 删除课程
// DELETE /api/v1/courses/:id
func (h *CourseHandler) DeleteCourse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 获取当前用户
	user, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 只有超级管理员可以删除课程
	if user.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super admin can delete courses"))
		return
	}

	// 从 URL 解析课程 ID
	courseIDStr := strings.TrimPrefix(r.URL.Path, "/api/v1/courses/")
	courseID, err := strconv.ParseInt(courseIDStr, 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid course id"))
		return
	}

	// 获取请求元数据
	meta := service.RequestMeta{
		APIKey:    r.Header.Get("x-api-key"),
		UserID:    user.Username,
		RequestID: r.Header.Get("x-request-id"),
	}

	// 删除课程
	err = h.courseService.DeleteCourse(r.Context(), meta, courseID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "course deleted successfully",
	})
}
