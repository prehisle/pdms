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

// APIKeyHandler API Key 管理的 HTTP handler
type APIKeyHandler struct {
	service *service.APIKeyService
}

// NewAPIKeyHandler 创建 API Key handler
func NewAPIKeyHandler(svc *service.APIKeyService) *APIKeyHandler {
	return &APIKeyHandler{service: svc}
}

// APIKeys 处理 API Keys 集合端点
func (h *APIKeyHandler) APIKeys(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listAPIKeys(w, r)
	case http.MethodPost:
		h.createAPIKey(w, r)
	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

// APIKeyRoutes 处理 API Key 单个资源端点
func (h *APIKeyHandler) APIKeyRoutes(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimPrefix(r.URL.Path, "/api/v1/api-keys/")
	if relPath == "" {
		h.APIKeys(w, r)
		return
	}

	// 特殊端点
	if relPath == "stats" {
		h.getAPIKeyStats(w, r)
		return
	}

	// 解析 ID
	parts := strings.Split(relPath, "/")
	if len(parts) == 0 {
		respondError(w, http.StatusBadRequest, errors.New("invalid path"))
		return
	}

	id, err := strconv.ParseUint(parts[0], 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid API key ID"))
		return
	}

	// 处理子资源
	if len(parts) > 1 {
		action := parts[1]
		switch action {
		case "revoke":
			h.revokeAPIKey(w, r, uint(id))
		default:
			respondError(w, http.StatusNotFound, errors.New("unknown action"))
		}
		return
	}

	// 处理单个资源操作
	switch r.Method {
	case http.MethodGet:
		h.getAPIKey(w, r, uint(id))
	case http.MethodPatch:
		h.updateAPIKey(w, r, uint(id))
	case http.MethodDelete:
		h.deleteAPIKey(w, r, uint(id))
	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

// createAPIKey 创建新的 API Key
func (h *APIKeyHandler) createAPIKey(w http.ResponseWriter, r *http.Request) {
	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found in context"))
		return
	}

	// 只有超级管理员可以创建 API Key
	if currentUser.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super admin can create API keys"))
		return
	}

	var req service.CreateAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid request body"))
		return
	}

	// 设置创建者 ID
	req.CreatedByID = currentUser.ID

	// 创建 API Key
	resp, err := h.service.CreateAPIKey(req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// listAPIKeys 列出 API Keys
func (h *APIKeyHandler) listAPIKeys(w http.ResponseWriter, r *http.Request) {
	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found in context"))
		return
	}

	// 解析查询参数
	query := r.URL.Query()
	includeDeleted := query.Get("include_deleted") == "true"

	// 非超级管理员只能查看自己的 API Keys
	var userID uint
	if currentUser.Role != "super_admin" {
		userID = currentUser.ID
	} else {
		// 超级管理员可以通过 user_id 参数过滤
		if userIDStr := query.Get("user_id"); userIDStr != "" {
			id, err := strconv.ParseUint(userIDStr, 10, 32)
			if err == nil {
				userID = uint(id)
			}
		}
	}

	keys, err := h.service.ListAPIKeys(userID, includeDeleted)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"api_keys": keys,
		"total":    len(keys),
	})
}

// getAPIKey 获取 API Key 详情
func (h *APIKeyHandler) getAPIKey(w http.ResponseWriter, r *http.Request, id uint) {
	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found in context"))
		return
	}

	key, err := h.service.GetAPIKey(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}

	// 权限检查：非超级管理员只能查看自己的 API Key
	if currentUser.Role != "super_admin" && key.UserID != currentUser.ID {
		respondError(w, http.StatusForbidden, errors.New("access denied"))
		return
	}

	writeJSON(w, http.StatusOK, key)
}

// updateAPIKey 更新 API Key 信息
func (h *APIKeyHandler) updateAPIKey(w http.ResponseWriter, r *http.Request, id uint) {
	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found in context"))
		return
	}

	// 获取现有的 API Key
	key, err := h.service.GetAPIKey(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}

	// 权限检查
	if currentUser.Role != "super_admin" && key.UserID != currentUser.ID {
		respondError(w, http.StatusForbidden, errors.New("access denied"))
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid request body"))
		return
	}

	// 只允许更新特定字段
	allowedFields := map[string]bool{
		"name":       true,
		"expires_at": true,
		"scopes":     true,
	}
	for field := range updates {
		if !allowedFields[field] {
			respondError(w, http.StatusBadRequest, errors.New("field '"+field+"' cannot be updated"))
			return
		}
	}

	updatedKey, err := h.service.UpdateAPIKey(id, updates)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, updatedKey)
}

// revokeAPIKey 撤销 API Key（软删除）
func (h *APIKeyHandler) revokeAPIKey(w http.ResponseWriter, r *http.Request, id uint) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found in context"))
		return
	}

	// 获取现有的 API Key
	key, err := h.service.GetAPIKey(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}

	// 权限检查
	if currentUser.Role != "super_admin" && key.UserID != currentUser.ID {
		respondError(w, http.StatusForbidden, errors.New("access denied"))
		return
	}

	if err := h.service.RevokeAPIKey(id); err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "API key revoked successfully",
	})
}

// deleteAPIKey 永久删除 API Key
func (h *APIKeyHandler) deleteAPIKey(w http.ResponseWriter, r *http.Request, id uint) {
	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found in context"))
		return
	}

	// 只有超级管理员可以永久删除
	if currentUser.Role != "super_admin" {
		respondError(w, http.StatusForbidden, errors.New("only super admin can permanently delete API keys"))
		return
	}

	if err := h.service.DeleteAPIKey(id); err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// getAPIKeyStats 获取 API Key 统计信息
func (h *APIKeyHandler) getAPIKeyStats(w http.ResponseWriter, r *http.Request) {
	// 获取当前用户
	currentUser, ok := r.Context().Value(auth.UserContextKey).(*database.User)
	if !ok {
		respondError(w, http.StatusUnauthorized, errors.New("user not found in context"))
		return
	}

	// 非超级管理员只能查看自己的统计
	var userID uint
	if currentUser.Role != "super_admin" {
		userID = currentUser.ID
	} else {
		// 超级管理员可以通过 user_id 参数过滤
		if userIDStr := r.URL.Query().Get("user_id"); userIDStr != "" {
			id, err := strconv.ParseUint(userIDStr, 10, 32)
			if err == nil {
				userID = uint(id)
			}
		}
	}

	stats, err := h.service.GetAPIKeyStats(userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, stats)
}
