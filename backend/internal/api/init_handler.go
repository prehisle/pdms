package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/yjxt/ydms/backend/internal/service"
)

// InitHandler 初始化相关 handler
type InitHandler struct {
	initService *service.InitService
}

// NewInitHandler 创建初始化 handler
func NewInitHandler(initService *service.InitService) *InitHandler {
	return &InitHandler{initService: initService}
}

// CheckStatus 检查系统初始化状态
// GET /api/v1/init/status
func (h *InitHandler) CheckStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	initialized, err := h.initService.IsInitialized()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{
		"initialized": initialized,
	})
}

// Setup 初始化系统（创建超级管理员）
// POST /api/v1/init/setup
func (h *InitHandler) Setup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	// 检查是否已初始化
	initialized, err := h.initService.IsInitialized()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	if initialized {
		respondError(w, http.StatusBadRequest, errors.New("system already initialized"))
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

	// 初始化超级管理员
	err = h.initService.InitializeSuperAdmin(req.Username, req.Password)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "system initialized successfully",
	})
}
