package api

import (
	"encoding/json"
	"net/http"

	"github.com/yjxt/ydms/backend/internal/service"
)

// Handler exposes HTTP handlers that delegate to the service layer.
type Handler struct {
	service *service.Service
}

// NewHandler returns a Handler wiring dependencies.
func NewHandler(service *service.Service) *Handler {
	return &Handler{service: service}
}

// Health reports basic liveness.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Ping returns a hello world message.
func (h *Handler) Ping(w http.ResponseWriter, r *http.Request) {
	message, err := h.service.Hello(r.Context())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": message})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
