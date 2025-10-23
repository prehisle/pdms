package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// NewRouter creates the HTTP router and wires handler endpoints.
func NewRouter(h *Handler) http.Handler {
	mux := http.NewServeMux()

	wrap := h.applyMiddleware

	mux.Handle("/healthz", wrap(http.HandlerFunc(h.Health)))
	mux.Handle("/api/v1/healthz", wrap(http.HandlerFunc(h.Health)))
	mux.Handle("/api/v1/ping", wrap(http.HandlerFunc(h.Ping)))
	mux.Handle("/api/v1/categories", wrap(http.HandlerFunc(h.Categories)))
	mux.Handle("/api/v1/categories/", wrap(http.HandlerFunc(h.CategoryRoutes)))
	mux.Handle("/api/v1/documents", wrap(http.HandlerFunc(h.Documents)))
	mux.Handle("/api/v1/documents/", wrap(http.HandlerFunc(h.DocumentRoutes)))
	mux.Handle("/api/v1/nodes/", wrap(http.HandlerFunc(h.NodeRoutes)))
	mux.Handle("/api/v1/authz/assignments", wrap(http.HandlerFunc(h.AuthzAssignments)))

	return mux
}

func (h *Handler) applyMiddleware(next http.Handler) http.Handler {
	handler := next
	handler = requestContextMiddleware(h.defaults.UserID)(handler)
	handler = authzMiddleware(h)(handler)
	handler = corsMiddleware(handler)
	handler = loggingMiddleware(handler)
	return handler
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
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-user-id, x-request-id, x-admin-key, x-authz-enforce, x-domain")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func requestContextMiddleware(defaultUserID string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("x-user-id") == "" && defaultUserID != "" {
				r.Header.Set("x-user-id", defaultUserID)
			}
			if r.Header.Get("x-request-id") == "" {
				r.Header.Set("x-request-id", uuid.NewString())
			}
			next.ServeHTTP(w, r)
		})
	}
}

// authzMiddleware performs Casbin checks. Report-only by default; can enforce via global or header.
func authzMiddleware(h *Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip preflight
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// If enforcer is not set, pass-through
			if h.enforcer == nil {
				next.ServeHTTP(w, r)
				return
			}

			sub := r.Header.Get("x-user-id")
			dom := r.Header.Get("x-domain")
			if dom == "" {
				dom = "*"
			}
			obj := r.URL.Path
			act := r.Method

			allowed, err := h.enforcer.Enforce(sub, dom, obj, act)
			if err != nil {
				// On error, do not block; log-like header and continue
				w.Header().Set("x-authz-error", err.Error())
				next.ServeHTTP(w, r)
				return
			}
			w.Header().Set("x-authz-allowed", strconv.FormatBool(allowed))

			// Enforce via global switch or header override
			enforce := h.authzEnforce || strings.EqualFold(r.Header.Get("x-authz-enforce"), "true")
			if !enforce || allowed {
				next.ServeHTTP(w, r)
				return
			}

			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
		})
	}
}
