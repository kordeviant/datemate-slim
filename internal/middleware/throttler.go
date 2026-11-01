package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	platformRedis "datemate/internal/platform/redis"
)

func Throttler(rdb *platformRedis.Client, cfg *config.Config) func(http.Handler) http.Handler {
	window := time.Duration(cfg.ThrottleTTL) * time.Millisecond
	defaultLimit := cfg.ThrottleLimit
	authLimit := cfg.ThrottleAuthLimit

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := strings.ToLower(r.URL.Path)

			// Skip throttling for internal health, static assets, and websocket handshake
			if path == "/health" || path == "/v1/health" || strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/static/") || strings.HasPrefix(path, "/chat") {
				next.ServeHTTP(w, r)
				return
			}

			clientIP := getClientIP(r)
			limit := defaultLimit
			key := fmt.Sprintf("throttle:%s", clientIP)

			// Stricter rate limit on auth endpoints
			if strings.Contains(path, "/auth/") {
				limit = authLimit
				key = fmt.Sprintf("throttle:auth:%s", clientIP)
			}

			allowed, remaining, retryAfter, err := rdb.RateLimitSlidingWindow(r.Context(), key, limit, window)
			if err != nil {
				// On Redis error, fail open to avoid service outage
				next.ServeHTTP(w, r)
				return
			}

			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

			if !allowed {
				w.Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
				common.RespondError(w, http.StatusTooManyRequests, "Too Many Requests", "TOO_MANY_REQUESTS")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
