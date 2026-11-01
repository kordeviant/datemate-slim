package middleware

import (
	"encoding/base64"
	"net"
	"net/http"
	"strings"

	"datemate/internal/common"
	"datemate/internal/config"
)

func DocsProtection(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := strings.ToLower(r.URL.Path)
			if !isDocsOrRulesRoute(path) {
				next.ServeHTTP(w, r)
				return
			}

			// 1. IP Whitelisting
			if cfg.DocsIPWhitelistEnabled && len(cfg.DocsAllowedIPs) > 0 {
				clientIP := getClientIP(r)
				allowed := false
				for _, ip := range cfg.DocsAllowedIPs {
					if ip == "*" || ip == clientIP || (clientIP == "127.0.0.1" && ip == "::1") || (clientIP == "::1" && ip == "127.0.0.1") {
						allowed = true
						break
					}
				}
				if !allowed {
					common.RespondError(w, http.StatusForbidden, "Access denied: Your IP is not whitelisted to access documentation", common.ErrForbidden)
					return
				}
			}

			// 2. HTTP Basic Auth
			if cfg.DocsAuthEnabled && cfg.DocsUsername != "" && cfg.DocsPassword != "" {
				authHeader := r.Header.Get("Authorization")
				if !strings.HasPrefix(authHeader, "Basic ") {
					w.Header().Set("WWW-Authenticate", `Basic realm="DateMate Documentation", charset="UTF-8"`)
					common.RespondError(w, http.StatusUnauthorized, "Access denied: Authentication required for documentation", common.ErrUnauthorized)
					return
				}

				payload, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(authHeader, "Basic "))
				if err != nil {
					w.Header().Set("WWW-Authenticate", `Basic realm="DateMate Documentation", charset="UTF-8"`)
					common.RespondError(w, http.StatusUnauthorized, "Access denied: Invalid authentication format", common.ErrUnauthorized)
					return
				}

				parts := strings.SplitN(string(payload), ":", 2)
				if len(parts) != 2 || parts[0] != cfg.DocsUsername || parts[1] != cfg.DocsPassword {
					w.Header().Set("WWW-Authenticate", `Basic realm="DateMate Documentation", charset="UTF-8"`)
					common.RespondError(w, http.StatusUnauthorized, "Access denied: Invalid documentation credentials", common.ErrUnauthorized)
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

func isDocsOrRulesRoute(path string) bool {
	normalized := strings.TrimRight(path, "/")
	return normalized == "/docs" || strings.HasPrefix(normalized, "/docs/") ||
		normalized == "/rules" || strings.HasPrefix(normalized, "/rules/") ||
		normalized == "/v1/docs" || strings.HasPrefix(normalized, "/v1/docs/") ||
		normalized == "/v1/rules" || strings.HasPrefix(normalized, "/v1/rules/") ||
		normalized == "/docs-json" || normalized == "/v1/docs-json"
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		ip := strings.TrimSpace(parts[0])
		if ip != "" {
			return normalizeIP(ip)
		}
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return normalizeIP(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return normalizeIP(host)
	}
	return normalizeIP(r.RemoteAddr)
}

func normalizeIP(ip string) string {
	clean := strings.TrimSpace(ip)
	if strings.HasPrefix(clean, "::ffff:") {
		clean = clean[7:]
	}
	if clean == "::1" {
		return "127.0.0.1"
	}
	return clean
}
