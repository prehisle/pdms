package cache

import "context"

// Provider defines the behaviour required from a cache implementation.
type Provider interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string, ttlSeconds int) error
	Delete(ctx context.Context, key string) error
}

// noopProvider is a no-op cache implementation used while caching is disabled.
type noopProvider struct{}

// NewNoop returns a Provider that performs no caching operations.
func NewNoop() Provider {
	return &noopProvider{}
}

func (n *noopProvider) Get(_ context.Context, _ string) (string, bool, error) {
	return "", false, nil
}

func (n *noopProvider) Set(_ context.Context, _ string, _ string, _ int) error {
	return nil
}

func (n *noopProvider) Delete(_ context.Context, _ string) error {
	return nil
}
