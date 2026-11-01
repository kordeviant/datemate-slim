package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/platform/database/db"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string

const UserContextKey contextKey = "authenticated_user"

type AuthUser struct {
	ID        int64
	Email     string
	Role      string
	SessionID int64
}

func GetAuthUser(ctx context.Context) (*AuthUser, bool) {
	u, ok := ctx.Value(UserContextKey).(*AuthUser)
	return u, ok
}

func JwtAuthGuard(cfg *config.Config, pool *pgxpool.Pool) func(http.Handler) http.Handler {
	queries := db.New(pool)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				common.RespondError(w, http.StatusUnauthorized, "Missing Authorization header", common.ErrUnauthorized)
				return
			}

			tokenStr := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
			tokenStr = strings.Trim(tokenStr, "\"'")

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				return []byte(cfg.JWTAccessSecret), nil
			})

			if err != nil || !token.Valid {
				common.RespondError(w, http.StatusUnauthorized, "Invalid or expired access token", common.ErrUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				common.RespondError(w, http.StatusUnauthorized, "Invalid token payload", common.ErrUnauthorized)
				return
			}

			subStr := fmt.Sprintf("%v", claims["sub"])
			userID, err := strconv.ParseInt(subStr, 10, 64)
			if err != nil {
				common.RespondError(w, http.StatusUnauthorized, "Invalid user identifier in token", common.ErrUnauthorized)
				return
			}

			email, _ := claims["email"].(string)
			role, _ := claims["role"].(string)
			if role == "" {
				role = "USER"
			}

			var sessionID int64
			if sVal, ok := claims["sessionId"]; ok {
				if sNum, ok := sVal.(float64); ok {
					sessionID = int64(sNum)
				}
			}

			// Validate session is active in database if sessionID present
			if sessionID > 0 {
				sess, err := queries.GetUserSessionByID(r.Context(), int32(sessionID))
				if err != nil || int64(sess.UserID) != userID {
					common.RespondError(w, http.StatusUnauthorized, "Session expired or terminated", common.ErrUnauthorized)
					return
				}
			}

			authUser := &AuthUser{
				ID:        userID,
				Email:     email,
				Role:      role,
				SessionID: sessionID,
			}

			ctx := context.WithValue(r.Context(), UserContextKey, authUser)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ApiKeyGuard(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := r.Header.Get("x-api-key")
			if apiKey == "" {
				common.RespondError(w, http.StatusUnauthorized, "Missing x-api-key header", common.ErrUnauthorized)
				return
			}

			if apiKey != cfg.InternalAPIKey && apiKey != cfg.DeviceTokenAPIKey && apiKey != cfg.PushNotificationAPIKey {
				common.RespondError(w, http.StatusForbidden, "Invalid API key", common.ErrForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
