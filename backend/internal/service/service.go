package service

import (
	"context"

	"github.com/yjxt/ydms/backend/internal/cache"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// Service encapsulates business logic and integrations.
type Service struct {
	cache cache.Provider
	ndr   ndrclient.Client
}

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
