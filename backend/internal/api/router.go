package api

import (
	"log"
	"net/http"
	"time"
)

// NewRouter creates the HTTP router and wires handler endpoints.
func NewRouter(h *Handler) http.Handler {
	mux := http.NewServeMux()

	mux.Handle("/healthz", applyMiddleware(http.HandlerFunc(h.Health)))
	mux.Handle("/api/v1/healthz", applyMiddleware(http.HandlerFunc(h.Health)))
	mux.Handle("/api/v1/ping", applyMiddleware(http.HandlerFunc(h.Ping)))
	mux.Handle("/api/v1/categories", applyMiddleware(http.HandlerFunc(h.Categories)))
	mux.Handle("/api/v1/categories/", applyMiddleware(http.HandlerFunc(h.CategoryRoutes)))

	return mux
}

func applyMiddleware(next http.Handler) http.Handler {
	return loggingMiddleware(corsMiddleware(next))
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lrw := &loggingResponseWriter{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(lrw, r)

		duration := time.Since(start)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, lrw.status, duration)
	})
}

type loggingResponseWriter struct {
	http.ResponseWriter
	status int
}

func (lrw *loggingResponseWriter) WriteHeader(status int) {
	lrw.status = status
	lrw.ResponseWriter.WriteHeader(status)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// For development we allow all origins; adjust as needed for production.
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-user-id, x-request-id")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
