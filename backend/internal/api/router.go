package api

import (
	"log"
	"net/http"
	"time"
)

// NewRouter creates the HTTP router and wires handler endpoints.
func NewRouter(h *Handler) http.Handler {
	mux := http.NewServeMux()

	mux.Handle("/healthz", loggingMiddleware(http.HandlerFunc(h.Health)))
	mux.Handle("/api/v1/healthz", loggingMiddleware(http.HandlerFunc(h.Health)))
	mux.Handle("/api/v1/ping", loggingMiddleware(http.HandlerFunc(h.Ping)))

	return mux
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
