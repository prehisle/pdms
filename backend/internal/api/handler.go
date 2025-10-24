package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
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
		if relPath == "bulk/delete" {
			h.bulkDeleteCategories(w, r, meta)
			return
		}
		if relPath == "bulk/purge" {
			h.bulkPurgeCategories(w, r, meta)
			return
		}
		if relPath == "bulk/check" {
			h.bulkCheckCategories(w, r, meta)
			return
		}
		if relPath == "bulk/copy" {
			h.bulkCopyCategories(w, r, meta)
			return
		}
		if relPath == "bulk/move" {
			h.bulkMoveCategories(w, r, meta)
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

// Documents handles collection-level document operations.
func (h *Handler) Documents(w http.ResponseWriter, r *http.Request) {
	meta := h.metaFromRequest(r)
	switch r.Method {
	case http.MethodGet:
		page, err := h.service.ListDocuments(r.Context(), meta, cloneQuery(r.URL.Query()))
		if err != nil {
			respondError(w, http.StatusBadGateway, err)
			return
		}
		writeJSON(w, http.StatusOK, page)
	case http.MethodPost:
		var payload service.DocumentCreateRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			respondError(w, http.StatusBadRequest, err)
			return
		}
		if strings.TrimSpace(payload.Title) == "" {
			respondError(w, http.StatusBadRequest, errors.New("title is required"))
			return
		}
		doc, err := h.service.CreateDocument(r.Context(), meta, payload)
		if err != nil {
			respondError(w, http.StatusBadGateway, err)
			return
		}
		writeJSON(w, http.StatusCreated, doc)
	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

// DocumentRoutes handles document-related operations and sub-resources.
func (h *Handler) DocumentRoutes(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimPrefix(r.URL.Path, "/api/v1/documents/")
	if relPath == "" {
		h.Documents(w, r)
		return
	}

	if relPath == "reorder" {
		h.reorderDocuments(w, r, h.metaFromRequest(r))
		return
	}

	parts := strings.Split(relPath, "/")
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid document id"))
		return
	}

	meta := h.metaFromRequest(r)

	if len(parts) == 1 {
		h.handleDocumentItem(w, r, meta, id)
		return
	}

	// Handle version-related routes
	if parts[1] == "versions" {
		if len(parts) == 2 {
			// GET /api/v1/documents/{id}/versions - list versions
			h.listDocumentVersions(w, r, meta, id)
			return
		}

		versionNum, err := strconv.Atoi(parts[2])
		if err != nil {
			respondError(w, http.StatusBadRequest, errors.New("invalid version number"))
			return
		}

		if len(parts) == 3 {
			// GET /api/v1/documents/{id}/versions/{version_number} - get specific version
			h.getDocumentVersion(w, r, meta, id, versionNum)
			return
		}

		if len(parts) == 4 {
			switch parts[3] {
			case "diff":
				// GET /api/v1/documents/{id}/versions/{version_number}/diff?to={to_version}
				h.getDocumentVersionDiff(w, r, meta, id, versionNum)
			case "restore":
				// POST /api/v1/documents/{id}/versions/{version_number}/restore
				h.restoreDocumentVersion(w, r, meta, id, versionNum)
			default:
				respondError(w, http.StatusNotFound, errors.New("not found"))
			}
			return
		}
	}

	respondError(w, http.StatusNotFound, errors.New("not found"))
}

func (h *Handler) handleDocumentItem(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	switch r.Method {
	case http.MethodPut:
		h.updateDocument(w, r, meta, id)
	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

func (h *Handler) updateDocument(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	var payload service.DocumentUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	doc, err := h.service.UpdateDocument(r.Context(), meta, id, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (h *Handler) reorderDocuments(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.DocumentReorderRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	docs, err := h.service.ReorderDocuments(r.Context(), meta, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, docs)
}

func (h *Handler) listDocumentVersions(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, docID int64) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	page := 1
	size := 20
	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if sizeStr := r.URL.Query().Get("size"); sizeStr != "" {
		if s, err := strconv.Atoi(sizeStr); err == nil && s > 0 {
			size = s
		}
	}

	versionsPage, err := h.service.ListDocumentVersions(r.Context(), meta, docID, page, size)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, versionsPage)
}

func (h *Handler) getDocumentVersion(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, docID int64, versionNum int) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	version, err := h.service.GetDocumentVersion(r.Context(), meta, docID, versionNum)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, version)
}

func (h *Handler) getDocumentVersionDiff(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, docID int64, fromVersion int) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	toVersionStr := r.URL.Query().Get("to")
	if toVersionStr == "" {
		respondError(w, http.StatusBadRequest, errors.New("to version parameter is required"))
		return
	}

	toVersion, err := strconv.Atoi(toVersionStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid to version"))
		return
	}

	diff, err := h.service.GetDocumentVersionDiff(r.Context(), meta, docID, fromVersion, toVersion)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, diff)
}

func (h *Handler) restoreDocumentVersion(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, docID int64, versionNum int) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}

	doc, err := h.service.RestoreDocumentVersion(r.Context(), meta, docID, versionNum)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

// NodeRoutes handles node-related sub-resources.
func (h *Handler) NodeRoutes(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimPrefix(r.URL.Path, "/api/v1/nodes/")
	if relPath == "" {
		respondError(w, http.StatusNotFound, errors.New("not found"))
		return
	}

	parts := strings.Split(relPath, "/")
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid node id"))
		return
	}

	meta := h.metaFromRequest(r)

	if len(parts) == 1 {
		respondError(w, http.StatusNotFound, errors.New("not found"))
		return
	}

	switch parts[1] {
	case "subtree-documents":
		if r.Method != http.MethodGet {
			respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
			return
		}
		docs, err := h.service.ListNodeDocuments(r.Context(), meta, id, cloneQuery(r.URL.Query()))
		if err != nil {
			respondError(w, http.StatusBadGateway, err)
			return
		}
		writeJSON(w, http.StatusOK, docs)
	case "bind":
		if len(parts) < 3 {
			respondError(w, http.StatusNotFound, errors.New("not found"))
			return
		}
		docID, err := strconv.ParseInt(parts[2], 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, errors.New("invalid document id"))
			return
		}
		if r.Method != http.MethodPost {
			respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
			return
		}
		if err := h.service.BindDocument(r.Context(), meta, id, docID); err != nil {
			respondError(w, http.StatusBadGateway, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
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

func (h *Handler) bulkDeleteCategories(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.CategoryBulkIDsRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	ids, err := h.service.BulkDeleteCategories(r.Context(), meta, payload.IDs)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted_ids": ids})
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

func (h *Handler) bulkCheckCategories(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload struct {
		IDs                []int64 `json:"ids"`
		IncludeDescendants *bool   `json:"include_descendants,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	includeDesc := true
	if payload.IncludeDescendants != nil {
		includeDesc = *payload.IncludeDescendants
	}
	if len(payload.IDs) == 0 {
		respondError(w, http.StatusBadRequest, errors.New("no ids provided"))
		return
	}
	resp, err := h.service.CheckCategoryDependencies(r.Context(), meta, service.CategoryCheckRequest{
		IDs:                payload.IDs,
		IncludeDescendants: includeDesc,
	})
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) bulkCopyCategories(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.CategoryBulkCopyRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	items, err := h.service.BulkCopyCategories(r.Context(), meta, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"items": items})
}

func (h *Handler) bulkMoveCategories(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
		return
	}
	var payload service.CategoryBulkMoveRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	items, err := h.service.BulkMoveCategories(r.Context(), meta, payload)
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func cloneQuery(values url.Values) url.Values {
	if values == nil {
		return nil
	}
	cloned := url.Values{}
	for k, v := range values {
		cloned[k] = append([]string(nil), v...)
	}
	return cloned
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

// Materials handles collection-level operations for materials (CRUD + list).
func (h *Handler) Materials(w http.ResponseWriter, r *http.Request) {
	meta := h.metaFromRequest(r)
	switch r.Method {
	case http.MethodGet:
		h.listMaterials(w, r, meta)
	case http.MethodPost:
		h.createMaterial(w, r, meta)
	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

// MaterialRoutes handles item-level operations for materials.
func (h *Handler) MaterialRoutes(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimPrefix(r.URL.Path, "/api/v1/materials/")
	if relPath == "" {
		h.Materials(w, r)
		return
	}

	id, err := strconv.ParseInt(relPath, 10, 64)
	if err != nil {
		respondError(w, http.StatusBadRequest, errors.New("invalid material id"))
		return
	}

	meta := h.metaFromRequest(r)
	h.handleMaterialItem(w, r, meta, id)
}

func (h *Handler) listMaterials(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	materials, total, err := h.service.ListMaterials(r.Context(), meta, cloneQuery(r.URL.Query()))
	if err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": materials,
		"total": total,
	})
}

func (h *Handler) createMaterial(w http.ResponseWriter, r *http.Request, meta service.RequestMeta) {
	var payload service.MaterialCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	material, err := h.service.CreateMaterial(r.Context(), meta, payload)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, material)
}

func (h *Handler) handleMaterialItem(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	switch r.Method {
	case http.MethodGet:
		h.getMaterial(w, r, meta, id)
	case http.MethodPut:
		h.updateMaterial(w, r, meta, id)
	case http.MethodDelete:
		h.deleteMaterial(w, r, meta, id)
	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

func (h *Handler) getMaterial(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	material, err := h.service.GetMaterial(r.Context(), meta, id)
	if err != nil {
		respondError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, material)
}

func (h *Handler) updateMaterial(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	var payload service.MaterialUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	material, err := h.service.UpdateMaterial(r.Context(), meta, id, payload)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, material)
}

func (h *Handler) deleteMaterial(w http.ResponseWriter, r *http.Request, meta service.RequestMeta, id int64) {
	if err := h.service.DeleteMaterial(r.Context(), meta, id); err != nil {
		respondError(w, http.StatusBadGateway, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Relationships handles node-document relationship operations.
func (h *Handler) Relationships(w http.ResponseWriter, r *http.Request) {
	meta := h.metaFromRequest(r)

	// 解析查询参数
	nodeIDStr := r.URL.Query().Get("node_id")
	docIDStr := r.URL.Query().Get("document_id")

	var nodeID, docID *int64
	if nodeIDStr != "" {
		id, err := strconv.ParseInt(nodeIDStr, 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, errors.New("invalid node_id"))
			return
		}
		nodeID = &id
	}
	if docIDStr != "" {
		id, err := strconv.ParseInt(docIDStr, 10, 64)
		if err != nil {
			respondError(w, http.StatusBadRequest, errors.New("invalid document_id"))
			return
		}
		docID = &id
	}

	switch r.Method {
	case http.MethodGet:
		// 列出关系
		rels, err := h.service.ListRelationships(r.Context(), meta, nodeID, docID)
		if err != nil {
			respondError(w, http.StatusBadGateway, err)
			return
		}
		writeJSON(w, http.StatusOK, rels)

	case http.MethodPost:
		// 创建关系
		if nodeID == nil || docID == nil {
			respondError(w, http.StatusBadRequest, errors.New("node_id and document_id required"))
			return
		}
		rel, err := h.service.BindRelationship(r.Context(), meta, *nodeID, *docID)
		if err != nil {
			respondError(w, http.StatusBadGateway, err)
			return
		}
		writeJSON(w, http.StatusCreated, rel)

	case http.MethodDelete:
		// 删除关系
		if nodeID == nil || docID == nil {
			respondError(w, http.StatusBadRequest, errors.New("node_id and document_id required"))
			return
		}
		err := h.service.UnbindRelationship(r.Context(), meta, *nodeID, *docID)
		if err != nil {
			respondError(w, http.StatusBadGateway, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		respondError(w, http.StatusMethodNotAllowed, errors.New("method not allowed"))
	}
}

func respondError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
