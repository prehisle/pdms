package config

import (
	"fmt"
	"os"
)

// Config holds application level configuration.
type Config struct {
	HTTPPort int
	NDR      NDRConfig
}

// NDRConfig stores settings for the upstream NDR service.
type NDRConfig struct {
	BaseURL string
	APIKey  string
}

// Load builds a Config object from environment variables, providing sane defaults.
func Load() Config {
	return Config{
		HTTPPort: parseEnvInt("YDMS_HTTP_PORT", 9180),
		NDR: NDRConfig{
			BaseURL: os.Getenv("YDMS_NDR_BASE_URL"),
			APIKey:  os.Getenv("YDMS_NDR_API_KEY"),
		},
	}
}

// HTTPAddress formats the address string the HTTP server should bind to.
func (c Config) HTTPAddress() string {
	return fmt.Sprintf(":%d", c.HTTPPort)
}

func parseEnvInt(key string, defaultValue int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return defaultValue
	}

	var value int
	if _, err := fmt.Sscanf(raw, "%d", &value); err != nil {
		return defaultValue
	}
	return value
}
