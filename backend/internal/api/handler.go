package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/yjxt/ydms/backend/internal/service"
)

// Handler exposes HTTP handlers that delegate to the service layer.
type Handler struct {
	service  *service.Service
	defaults HeaderDefaults
}

type HeaderDefaults struct {
	APIKey   string
	UserID   string
	AdminKey string
}

// NewHandler returns a Handler wiring dependencies.
func NewHandler(service *service.Service, defaults HeaderDefaults) *Handler {
	return &Handler{service: service, defaults: defaults}
}

// Health reports basic liveness.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Ping returns a hello world message.
func (h *Handler) Ping(w http.ResponseWriter, r *http.Request) {
	message, err := h.service.Hello(r.Context())
	if err != nil {
		respondError(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": message})
}

// Categories handles collection-level operations.
func (h *Handler) Categories(w http.ResponseWriter, r *http.Request) {
	meta := h.metaFromRequest(r)
	switch r.Method {
	case http.MethodPost:
		h.createCategory(w, r, meta)
	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

// CategoryRoutes handles item-level operations based on suffix.
func (h *Handler) CategoryRoutes(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimPrefix(r.URL.Path, "/api/v1/categories/")
	if relPath == "" {
		h.Categories(w, r)
		return
	}

	if relPath == "reorder" {
		h.reorderCategories(w, r, h.metaFromRequest(r))
		return
	}

	if relPath == "trash" {
		h.listDeletedCategories(w, r, h.metaFromRequest(r))
		return
	}

	if strings.HasPrefix(relPath, "bulk/") {
		meta := h.metaFromRequest(r)
		if relPath == "bulk/restore" {
			h.bulkRestoreCategories(w, r, meta)
			return
		}
		if relPath == "bulk/purge" {
			h.bulkPurgeCategories(w, r, meta)
			return
		}
		respondError(w, http.StatusNotFound, errors.New("not found"))
		return
	}

	meta := h.metaFromRequest(r)

	if relPath == "tree" {
		h.listCategoryTree(w, r, meta)
		return
	}

	parts := strings.Split(relPath, "/")
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid category id"))
		return
	}

	if len(parts) == 1 {
		h.handleCategoryItem(w, r, meta, id)
		return
	}

	switch parts[1] {
	case "restore":
		h.restoreCategory(w, r, meta, id)
	case "move":
		h.moveCategory(w, r, meta, id)
	case "purge":
		h.purgeCategory(w, r, meta, id)
	case "reposition":
		h.repositionCategory(w, r, meta, id)
	default:
		respondError(w, http.StatusNotFound, errors.New("not found"))
	}
}

func (h *Handler) handleCategoryItem(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	switch r.Method {
	case http.MethodGet:
		h.getCategory(w, r, meta, id)
	case http.MethodPatch:
		h.updateCategory(w, r, meta, id)
	case http.MethodDelete:
		h.deleteCategory(w, r, meta, id)
	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

func (h *Handler) createCategory(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	var payload service.CategoryCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	category, err := h.service.CreateCategory(r.Context(), meta, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, category)
}

func (h *Handler) getCategory(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	includeDeleted := r.URL.Query().Get("include_deleted") == "true"
	category, err := h.service.GetCategory(r.Context(), meta, id, includeDeleted)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, category)
}

func (h *Handler) updateCategory(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	var payload service.CategoryUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	category, err := h.service.UpdateCategory(r.Context(), meta, id, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, category)
}

func (h *Handler) deleteCategory(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	if err := h.service.DeleteCategory(r.Context(), meta, id); err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) restoreCategory(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	category, err := h.service.RestoreCategory(r.Context(), meta, id)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, category)
}

func (h *Handler) moveCategory(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	if r.Method != http.MethodPatch {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.MoveCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	category, err := h.service.MoveCategory(r.Context(), meta, id, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, category)
}

func (h *Handler) listCategoryTree(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	includeDeleted := r.URL.Query().Get("include_deleted") == "true"
	tree, err := h.service.GetCategoryTree(r.Context(), meta, includeDeleted)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, tree)
}

func (h *Handler) reorderCategories(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.CategoryReorderRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	categories, err := h.service.ReorderCategories(r.Context(), meta, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, categories)
}

func (h *Handler) listDeletedCategories(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	items, err := h.service.GetDeletedCategories(r.Context(), meta)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) purgeCategory(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	if r.Method != http.MethodDelete {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	if err := h.service.PurgeCategory(r.Context(), meta, id); err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) repositionCategory(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	if r.Method != http.MethodPatch {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.CategoryRepositionRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	result, err := h.service.RepositionCategory(r.Context(), meta, id, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) bulkRestoreCategories(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.CategoryBulkIDsRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	items, err := h.service.BulkRestoreCategories(r.Context(), meta, payload.IDs)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) bulkPurgeCategories(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.CategoryBulkIDsRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	ids, err := h.service.BulkPurgeCategories(r.Context(), meta, payload.IDs)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"purged_ids": ids})
}

func (h *Handler) metaFromRequest(r *http.Request) service.RequestMeta {
	apiKey := r.Header.Get("x-api-key")
	if apiKey == "" {
		apiKey = h.defaults.APIKey
	}
	userID := r.Header.Get("x-user-id")
	if userID == "" {
		userID = h.defaults.UserID
	}
	requestID := r.Header.Get("x-request-id")
	return service.RequestMeta{
		APIKey:    apiKey,
		UserID:    userID,
		RequestID: requestID,
		AdminKey:  headerFallback(r.Header.Get("x-admin-key"), h.defaults.AdminKey),
	}
}

func headerFallback(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func respondError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
