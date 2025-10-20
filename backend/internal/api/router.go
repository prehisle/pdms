package api

import "net/http"

// NewRouter creates the HTTP router and wires handler endpoints.
func NewRouter(h *Handler) *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", h.Health)
	mux.HandleFunc("/api/v1/ping", h.Ping)

	return mux
}
