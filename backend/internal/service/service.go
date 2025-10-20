package service

import (
	"context"
	"regexp"
	"strings"

	"github.com/yjxt/ydms/backend/internal/cache"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// Service encapsulates business logic and integrations.
type Service struct {
	cache cache.Provider
	ndr   ndrclient.Client
}

// RequestMeta propagates authentication info to downstream services.
type RequestMeta = ndrclient.RequestMeta

// NewService wires dependencies together.
func NewService(cache cache.Provider, ndr ndrclient.Client) *Service {
	return &Service{
		cache: cache,
		ndr:   ndr,
	}
}

// Hello returns a friendly greeting, placeholder for future domain logic.
func (s *Service) Hello(ctx context.Context) (string, error) {
	if err := s.ndr.Ping(ctx); err != nil {
		return "", err
	}
	return "Hello from YDMS backend!", nil
}

var slugRegex = regexp.MustCompile(`[^a-z0-9]+`)

// slugify converts a name into a URL-safe slug.
func slugify(name string) string {
	trimmed := strings.TrimSpace(strings.ToLower(name))
	replaced := slugRegex.ReplaceAllString(trimmed, "-")
	return strings.Trim(replaced, "-")
}
