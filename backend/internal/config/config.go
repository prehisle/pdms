package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds application level configuration.
type Config struct {
	HTTPPort int
	NDR      NDRConfig
	Auth     AuthConfig
}

// NDRConfig stores settings for the upstream NDR service.
type NDRConfig struct {
	BaseURL string
	APIKey  string
}

// AuthConfig contains defaults for user/request metadata.
type AuthConfig struct {
	DefaultUserID string
	AdminKey      string
}

// Load builds a Config object from environment variables, providing sane defaults.
func Load() Config {
	return Config{
		HTTPPort: parseEnvInt("YDMS_HTTP_PORT", 9180),
		NDR: NDRConfig{
			BaseURL: firstNonEmpty(os.Getenv("YDMS_NDR_BASE_URL"), "not_set"),
			APIKey:  firstNonEmpty(os.Getenv("YDMS_NDR_API_KEY"), "not_set"),
		},
		Auth: AuthConfig{
			DefaultUserID: firstNonEmpty(os.Getenv("YDMS_DEFAULT_USER_ID"), "system"),
			AdminKey:      firstNonEmpty(os.Getenv("YDMS_ADMIN_KEY"), "not_set"),
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

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
