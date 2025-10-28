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

// UserHandler 用户管理 handler
type UserHandler struct {
	userService *service.UserService
}

// NewUserHandler 创建用户管理 handler
func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// ListUsers 列出用户
// GET /api/v1/users?role=xxx
func (h *UserHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
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

	// 只有超级管理员可以列出用户
	if user.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super administrators can list users"))
		return
	}

	// 获取查询参数
	role := r.URL.Query().Get("role")

	// 列出用户
	users, err := h.userService.ListUsers(role)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

  writeJSON(w, http.StatusOK, map[string]interface{}{
    "users": users,
  })
}

// CreateUser 创建用户
// POST /api/v1/users
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 解析请求
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	// 验证输入
	if req.Username == "" || req.Password == "" || req.Role == "" {
		respondError(w, http.StatusBadRequest, errors.New("username, password and role are required"))
		return
	}

	// 权限检查：只有超级管理员可以创建用户
	if currentUser.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super administrators can create users"))
		return
	}

	// 创建用户
	newUser, err := h.userService.CreateUser(req.Username, req.Password, req.Role, &currentUser.ID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"user": newUser,
	})
}

// GetUser 获取用户详情
// GET /api/v1/users/:id
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 从 URL 解析用户 ID
	userIDStr := strings.TrimPrefix(r.URL.Path, "/api/v1/users/")
	userIDStr = strings.Split(userIDStr, "/")[0]
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid user id"))
		return
	}

	// 获取用户
	user, err := h.userService.GetUserByID(uint(userID))
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"user": user,
	})
}

// DeleteUser 删除用户
// DELETE /api/v1/users/:id
func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 只有超级管理员可以删除用户
	if currentUser.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super administrators can delete users"))
		return
	}

	// 从 URL 解析用户 ID
	userIDStr := strings.TrimPrefix(r.URL.Path, "/api/v1/users/")
	userIDStr = strings.Split(userIDStr, "/")[0]
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid user id"))
		return
	}

	// 不能删除自己
	if currentUser.ID == uint(userID) {
		respondError(w, http.StatusBadRequest, errors.New("cannot delete yourself"))
		return
	}

	// 删除用户
	err = h.userService.DeleteUser(uint(userID))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "user deleted successfully",
	})
}

// GrantCoursePermission 授予课程权限
// POST /api/v1/users/:id/courses
func (h *UserHandler) GrantCoursePermission(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 只有超级管理员可以授予权限
	if currentUser.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super administrators can grant course permissions"))
		return
	}

	// 从 URL 解析用户 ID
	pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/users/"), "/")
	if len(pathParts) < 2 {
		respondError(w, http.StatusBadRequest, errors.New("invalid path"))
		return
	}

	userID, err := strconv.ParseUint(pathParts[0], 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid user id"))
		return
	}

	// 解析请求
	var req struct {
		RootNodeID int64 `json:"root_node_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	// 授予权限
	err = h.userService.GrantCoursePermission(uint(userID), req.RootNodeID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "permission granted successfully",
	})
}

// RevokeCoursePermission 撤销课程权限
// DELETE /api/v1/users/:id/courses/:nodeId
func (h *UserHandler) RevokeCoursePermission(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 只有超级管理员可以撤销权限
	if currentUser.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super administrators can revoke course permissions"))
		return
	}

	// 从 URL 解析用户 ID 和课程 ID
	pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/users/"), "/")
	if len(pathParts) < 3 {
		respondError(w, http.StatusBadRequest, errors.New("invalid path"))
		return
	}

	userID, err := strconv.ParseUint(pathParts[0], 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid user id"))
		return
	}

	nodeID, err := strconv.ParseInt(pathParts[2], 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid node id"))
		return
	}

	// 撤销权限
	err = h.userService.RevokeCoursePermission(uint(userID), nodeID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "permission revoked successfully",
	})
}

// GetUserCourses 获取用户的课程权限列表
// GET /api/v1/users/:id/courses
func (h *UserHandler) GetUserCourses(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 从 URL 解析用户 ID
	pathParts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/v1/users/"), "/")
	if len(pathParts) < 2 {
		respondError(w, http.StatusBadRequest, errors.New("invalid path"))
		return
	}

	userID, err := strconv.ParseUint(pathParts[0], 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid user id"))
		return
	}

	// 获取课程权限
	courses, err := h.userService.GetUserCourses(uint(userID))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"course_ids": courses,
	})
}
