package common

import (
	"fmt"
	"net/url"
	"strings"
)

// ResolveAssetURL converts any stored relative path, legacy /uploads path,
// bare filename, or localhost URL into a fully-qualified public asset URL.
// It guarantees that:
// 1. Storage is independent from the public domain (no hardcoded localhost or domain in DB).
// 2. Any old localhost or loopback URLs (e.g. http://localhost:3000/assets/...) are re-based to baseURL.
// 3. Absolute URLs to third-party CDNs or external origins are preserved as-is.
// 4. Relative paths starting with "uploads/" or "assets/" or bare categories are resolved to "<baseURL>/assets/<category>/<filename>".
func ResolveAssetURL(baseURL, raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if base == "" {
		base = "http://localhost:3000"
	}

	// Check if already an absolute HTTP/HTTPS URL
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		parsed, err := url.Parse(trimmed)
		if err == nil {
			hostname := parsed.Hostname()
			// If it's localhost or loopback (e.g. from local testing or dev), rebase it to baseURL
			if hostname == "localhost" || hostname == "127.0.0.1" || hostname == "::1" || hostname == "0.0.0.0" {
				trimmed = parsed.Path
			} else {
				return trimmed
			}
		} else {
			return trimmed
		}
	}

	// Clean leading slashes
	clean := strings.TrimPrefix(trimmed, "/")

	// Strip container/filesystem prefix if present (e.g. "app/uploads/...")
	if strings.HasPrefix(clean, "app/") {
		clean = strings.TrimPrefix(clean, "app/")
	}

	// Handle uploads/ prefix
	if strings.HasPrefix(clean, "uploads/") {
		sub := strings.TrimPrefix(clean, "uploads/")
		sub = strings.TrimPrefix(sub, "/")
		if strings.HasPrefix(sub, "chat/") {
			return fmt.Sprintf("%s/uploads/%s", base, strings.TrimPrefix(sub, "chat/"))
		}
		if !strings.Contains(sub, "/") {
			// Bare filename in uploads, e.g. uploads/uuid.ogg (chat attachment)
			return fmt.Sprintf("%s/uploads/%s", base, sub)
		}
		return fmt.Sprintf("%s/assets/%s", base, sub)
	}

	// Chat files prefix (chat/filename or chat/files/filename)
	if strings.HasPrefix(clean, "chat/") {
		sub := strings.TrimPrefix(clean, "chat/")
		sub = strings.TrimPrefix(sub, "files/")
		return fmt.Sprintf("%s/uploads/%s", base, strings.TrimPrefix(sub, "/"))
	}

	// Modern /assets/ prefix
	if strings.HasPrefix(clean, "assets/") {
		sub := strings.TrimPrefix(clean, "assets/")
		sub = strings.TrimPrefix(sub, "/")
		if strings.HasPrefix(sub, "chat/") {
			return fmt.Sprintf("%s/uploads/%s", base, strings.TrimPrefix(sub, "chat/"))
		}
		return fmt.Sprintf("%s/assets/%s", base, sub)
	}

	// Has a category/filename structure (e.g. "avatars/photo.webp", "images/pic.webp")
	if strings.Contains(clean, "/") {
		return fmt.Sprintf("%s/assets/%s", base, clean)
	}

	// Bare filename fallback -> default to "images" category
	return fmt.Sprintf("%s/assets/images/%s", base, clean)
}

