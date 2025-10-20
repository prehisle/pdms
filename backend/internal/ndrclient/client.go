package ndrclient

import "context"

// Client defines the contract for interacting with the upstream NDR service.
type Client interface {
	Ping(ctx context.Context) error
}

type noopClient struct {
	cfg NDRConfig
}

// NDRConfig describes the minimal configuration required by the client.
type NDRConfig struct {
	BaseURL string
	APIKey  string
}

// NewClient returns a placeholder implementation. Real HTTP plumbing will replace this.
func NewClient(cfg NDRConfig) Client {
	return &noopClient{cfg: cfg}
}

func (c *noopClient) Ping(_ context.Context) error {
	return nil
}
