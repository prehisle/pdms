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
	AuthZ    AuthZConfig
	Debug    DebugConfig
	DB       DBConfig
}

// NDRConfig stores settings for the upstream NDR service.
type NDRConfig struct {
	BaseURL string
	APIKey  string
}

// DebugConfig stores flags that affect logging and diagnostics.
type DebugConfig struct {
	Traffic bool
}

// AuthConfig contains defaults for user/request metadata.
type AuthConfig struct {
	DefaultUserID string
	AdminKey      string
}

// AuthZConfig controls authorization enforcement behavior.
type AuthZConfig struct {
	Enforce bool
}

// DBConfig stores database connection settings.
type DBConfig struct {
	DSN string
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
			DefaultUserID: firstNonEmpty(os.Getenv("YDMS_DEFAULT_USER_ID"), "dms"),
			AdminKey:      firstNonEmpty(os.Getenv("YDMS_ADMIN_KEY"), "not_set"),
		},
		AuthZ: AuthZConfig{
			Enforce: parseEnvBool("YDMS_AUTHZ_ENFORCE", false),
		},
		Debug: DebugConfig{
			Traffic: parseEnvBool("YDMS_DEBUG_TRAFFIC", false),
		},
		DB: DBConfig{
			DSN: firstNonEmpty(os.Getenv("YDMS_DB_DSN"), "not_set"),
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

func parseEnvBool(key string, defaultValue bool) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if raw == "" {
		return defaultValue
	}
	switch raw {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return defaultValue
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
