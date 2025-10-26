package service

import (
	"context"
	"fmt"
	"hash/crc32"
	"regexp"
	"strings"
	"unicode"

	"github.com/yjxt/ydms/backend/internal/cache"
	"github.com/yjxt/ydms/backend/internal/ndrclient"
)

// Service encapsulates business logic and integrations.
type Service struct {
	cache       cache.Provider
	ndr         ndrclient.Client
	userService *UserService // 用于查询用户权限
}

// RequestMeta propagates authentication info to downstream services.
type RequestMeta struct {
	APIKey        string
	UserID        string
	RequestID     string
	AdminKey      string
	UserRole      string // 用户角色
	UserIDNumeric uint   // 用户 ID (数字)
}

func toNDRMeta(meta RequestMeta) ndrclient.RequestMeta {
	return ndrclient.RequestMeta{
		APIKey:    meta.APIKey,
		UserID:    meta.UserID,
		RequestID: meta.RequestID,
		AdminKey:  meta.AdminKey,
	}
}

// NewService wires dependencies together.
func NewService(cache cache.Provider, ndr ndrclient.Client, userService *UserService) *Service {
	return &Service{
		cache:       cache,
		ndr:         ndr,
		userService: userService,
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
	trimmedOriginal := strings.TrimSpace(name)
	if trimmedOriginal == "" {
		return ""
	}

	lower := strings.ToLower(trimmedOriginal)
	replaced := slugRegex.ReplaceAllString(lower, "-")
	cleaned := strings.Trim(replaced, "-")
	if cleaned == "" {
		return ""
	}

	if requiresSlugSalt(trimmedOriginal) {
		checksum := crc32.ChecksumIEEE([]byte(trimmedOriginal))
		cleaned = strings.Trim(cleaned, "-")
		cleaned = fmt.Sprintf("%s-%04x", cleaned, checksum&0xffff)
	}

	return cleaned
}

func requiresSlugSalt(name string) bool {
	for _, r := range name {
		if r > unicode.MaxASCII {
			return true
		}
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' || r == '-') {
			return true
		}
	}
	return false
}
