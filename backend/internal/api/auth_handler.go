package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/yjxt/ydms/backend/internal/auth"
	"github.com/yjxt/ydms/backend/internal/database"
	"github.com/yjxt/ydms/backend/internal/service"
)

// AuthHandler 认证相关 handler
type AuthHandler struct {
	userService *service.UserService
	jwtSecret   string
	jwtExpiry   time.Duration
}

// NewAuthHandler 创建认证 handler
func NewAuthHandler(userService *service.UserService, jwtSecret string, jwtExpiry time.Duration) *AuthHandler {
	return &AuthHandler{
		userService: userService,
		jwtSecret:   jwtSecret,
		jwtExpiry:   jwtExpiry,
	}
}

// Login 用户登录
// POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 解析请求
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	// 验证输入
	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, errors.New("username and password are required"))
		return
	}

	// 认证用户
	user, err := h.userService.Authenticate(req.Username, req.Password)
	if err != nil {
		respondError(w, http.StatusUnauthorized, err)
		return
	}

	// 生成 token
	token, err := h.userService.GenerateToken(user, h.jwtSecret, h.jwtExpiry)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": token,
		"user": map[string]interface{}{
			"id":       user.ID,
			"username": user.Username,
			"role":     user.Role,
		},
	})
}

// Logout 用户登出
// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// JWT 是无状态的，logout 主要由前端处理（删除 token）
	// 这里返回成功即可
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "logged out successfully",
	})
}

// Me 获取当前用户信息
// GET /api/v1/auth/me
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 从 context 获取用户信息（由中间件设置）
	user, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 从数据库获取完整用户信息
	fullUser, err := h.userService.GetUserByID(user.ID)
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"id":           fullUser.ID,
		"username":     fullUser.Username,
		"role":         fullUser.Role,
		"display_name": fullUser.DisplayName,
		"created_at":   fullUser.CreatedAt,
	})
}

// ChangePassword 修改密码
// POST /api/v1/auth/change-password
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 从 context 获取当前用户
	user, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found"))
		return
	}

	// 解析请求
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	// 验证输入
	if req.OldPassword == "" || req.NewPassword == "" {
		respondError(w, http.StatusBadRequest, errors.New("old password and new password are required"))
		return
	}

	// 验证旧密码
	_, err := h.userService.Authenticate(user.Username, req.OldPassword)
	if err != nil {
		respondError(w, http.StatusUnauthorized, errors.New("invalid old password"))
		return
	}

	// 更新密码
	err = h.userService.UpdatePassword(user.ID, req.NewPassword)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "password changed successfully",
	})
}
