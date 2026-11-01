package test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/modules/admin"
	"datemate/internal/modules/auth"
	"datemate/internal/modules/chat"
	"datemate/internal/modules/friends"
	"datemate/internal/modules/interests"
	"datemate/internal/modules/matching"
	"datemate/internal/modules/media"
	"datemate/internal/modules/notifications"
	"datemate/internal/modules/questions"
	"datemate/internal/modules/recommended"
	"datemate/internal/modules/system"
	"datemate/internal/modules/users"
	"datemate/internal/platform/fcm"
	"datemate/internal/platform/geo"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// List of all authoritative endpoints from datemate-api.json plus mandatory Go-port routes
var allRouteEndpoints = []struct {
	Method string
	Path   string
}{
	// System / Common
	{"GET", "/"},
	{"GET", "/health"},
	{"GET", "/time"},
	{"GET", "/rules"},
	{"GET", "/docs/rules"},
	{"GET", "/asyncapi-json"},

	// Auth
	{"POST", "/auth/signup"},
	{"POST", "/auth/verify"},
	{"POST", "/auth/signin"},
	{"POST", "/auth/refresh"},
	{"POST", "/auth/forgot-password"},
	{"POST", "/auth/reset-password"},
	{"POST", "/auth/nonce"},
	{"POST", "/auth/google"},
	{"POST", "/auth/apple"},
	{"POST", "/auth/logout"},

	// Feed & Matching
	{"GET", "/feed"},
	{"POST", "/swipes"},
	{"GET", "/matches"},
	{"GET", "/likes"},

	// Recommended
	{"GET", "/recommended"},
	{"GET", "/recommended/detail"},

	// Questions & Interests
	{"GET", "/questions"},
	{"GET", "/questions/search"},
	{"GET", "/questions/type/SINGLE"},
	{"GET", "/questions/1"},
	{"GET", "/interests"},
	{"GET", "/interests/1"},
	{"GET", "/interest"},
	{"GET", "/interest/1"},

	// Users
	{"GET", "/users/profile"},
	{"PUT", "/users/profile"},
	{"POST", "/users/profile"},
	{"GET", "/users/me"},
	{"GET", "/users/1"},
	{"POST", "/users/bulk"},
	{"DELETE", "/users/account"},
	{"DELETE", "/users/me"},
	{"GET", "/users/devices"},
	{"DELETE", "/users/devices/1"},
	{"DELETE", "/users/devices"},
	{"DELETE", "/users/gallery/1"},
	{"PUT", "/users/device-token"},
	{"GET", "/users/1/device-token"},
	{"GET", "/users/1/avatar"},
	{"GET", "/users/avatars/1,2"},

	// Admin
	{"GET", "/admin/dashboard/stats"},
	{"GET", "/admin/dashboard/overview"},
	{"GET", "/admin/users"},
	{"GET", "/admin/users/count"},
	{"GET", "/admin/users/pending-selfies/count"},
	{"GET", "/admin/users/1"},
	{"PATCH", "/admin/users/1"},
	{"PUT", "/admin/users/1"},
	{"POST", "/admin/users/1/ban"},
	{"POST", "/admin/users/1/unban"},
	{"DELETE", "/admin/users/1"},
	{"DELETE", "/admin/users/1/gallery/1"},
	{"GET", "/admin/users/1/devices"},
	{"DELETE", "/admin/users/1/devices/1"},
	{"DELETE", "/admin/users/1/devices"},
	{"GET", "/admin/verifications"},
	{"GET", "/admin/verifications/count"},
	{"GET", "/admin/verifications/pending/count"},
	{"POST", "/admin/verifications/1/approve"},
	{"POST", "/admin/verifications/1/reject"},

	// Media & Assets
	{"GET", "/media/types"},
	{"POST", "/media/upload/images"},
	{"POST", "/media/upload/avatars"},
	{"POST", "/media/upload/icons"},
	{"POST", "/assets/upload/images"},
	{"GET", "/assets/images/sample.jpg"},
	{"GET", "/assets/avatars/sample.jpg"},
	{"GET", "/assets/icons/sample.svg"},
	{"GET", "/assets/selfies/sample.jpg"},

	// Chat & Groups
	{"GET", "/conversations"},
	{"POST", "/conversations"},
	{"GET", "/conversations/direct"},
	{"GET", "/conversations/group"},
	{"GET", "/conversations/1"},
	{"GET", "/conversations/1/messages"},
	{"GET", "/groups/1"},
	{"POST", "/groups"},
	{"PATCH", "/groups/1"},
	{"GET", "/groups/1/participants"},
	{"GET", "/groups/1/participants/1"},
	{"POST", "/groups/1/join"},
	{"POST", "/groups/1/invitations/accept"},
	{"POST", "/groups/1/join-requests/approve"},
	{"POST", "/groups/1/bans"},
	{"GET", "/users/1/activity"},
	{"POST", "/users/activity"},
	{"POST", "/chat/upload"},
	{"GET", "/uploads/sample.jpg"},
	{"GET", "/chat/files/sample.jpg"},

	// Friends
	{"GET", "/friends"},
	{"POST", "/friends/add"},
	{"GET", "/friends/requests"},
	{"POST", "/friends/accept/1"},
	{"POST", "/friends/reject/1"},
	{"POST", "/friends/cancel/1"},
	{"DELETE", "/friends/1"},

	// Push Notifications
	{"POST", "/push"},
	{"POST", "/notifications/push"},

	// Geo & Downloads
	{"GET", "/geo/countries"},
	{"GET", "/geo/countries/1"},
	{"GET", "/geo/countries/1/states"},
	{"GET", "/geo/countries/1/cities"},
	{"GET", "/geo/countries/1/hierarchy"},
	{"GET", "/geo/states"},
	{"GET", "/geo/states/1"},
	{"GET", "/geo/states/1/cities"},
	{"GET", "/geo/cities"},
	{"GET", "/geo/cities/1"},
	{"GET", "/downloads"},
	{"GET", "/downloads/catalog"},
	{"GET", "/downloads/raw/countries.json"},
	{"GET", "/downloads/countries"},
	{"GET", "/downloads/states"},
	{"GET", "/downloads/cities"},
	{"GET", "/downloads/hierarchy"},
	{"GET", "/downloads/package/countries"},
}

func setupRealRouter() *chi.Mux {
	r := chi.NewRouter()

	ctx := context.Background()
	pool, _ := pgxpool.New(ctx, "postgres://postgres:postgres@localhost:5432/datemate_verify_db?sslmode=disable")

	cfg := &config.Config{
		Host:                   "0.0.0.0",
		Port:                   "3000",
		AssetBaseURL:           "http://localhost:3000/assets",
		UploadsDir:             "/tmp/datemate_test_uploads",
		GeoDataDir:             "data/geo",
		PaginationDefaultLimit: 20,
		PaginationMaxLimit:     100,
	}

	for _, sub := range []string{"images", "avatars", "icons", "selfies", "chat", ""} {
		dir := filepath.Join(cfg.UploadsDir, sub)
		_ = os.MkdirAll(dir, 0755)
		_ = os.WriteFile(filepath.Join(dir, "sample.jpg"), []byte("sample"), 0644)
		_ = os.WriteFile(filepath.Join(dir, "sample.svg"), []byte("<svg></svg>"), 0644)
	}

	storageEngine, _ := storage.NewLocalEngine(cfg.UploadsDir)
	geoService := geo.NewService(cfg.GeoDataDir)
	fcmDispatcher := fcm.NewDispatcher(pool, true, 1, 10)

	// Domain Services with nil-safe/mock wiring
	authSvc := auth.NewService(cfg, pool, nil, nil)
	userSvc := users.NewService(cfg, pool, geoService, storageEngine)
	matchingSvc := matching.NewService(cfg, pool, nil, geoService, fcmDispatcher)
	recommendedSvc := recommended.NewService(cfg, pool, nil, geoService, userSvc)
	friendsSvc := friends.NewService(cfg, pool, fcmDispatcher)
	chatSvc := chat.NewService(cfg, pool, nil, fcmDispatcher, storageEngine)
	questionsSvc := questions.NewService(cfg, pool)
	interestsSvc := interests.NewService(cfg, pool)
	adminSvc := admin.NewService(cfg, pool, nil)

	// Real Domain Handlers
	authHandler := auth.NewHandler(authSvc, cfg, pool)
	usersHandler := users.NewHandler(userSvc, cfg, pool)
	matchingHandler := matching.NewHandler(matchingSvc, cfg, pool)
	recommendedHandler := recommended.NewHandler(recommendedSvc, cfg, pool)
	friendsHandler := friends.NewHandler(friendsSvc, cfg, pool)
	chatHandler := chat.NewHandler(chatSvc, cfg, pool)
	mediaHandler := media.NewHandler(cfg, storageEngine)
	notificationsHandler := notifications.NewHandler(cfg, fcmDispatcher)
	questionsHandler := questions.NewHandler(questionsSvc, cfg, pool)
	interestsHandler := interests.NewHandler(interestsSvc, cfg, pool)
	adminHandler := admin.NewHandler(adminSvc, cfg, pool)
	systemHandler := system.NewHandler("docs")
	geoHandler := geo.NewHandler(geoService)

	// Inject test auth context so protected routes have a valid user
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := &middleware.AuthUser{
				ID:        1,
				Email:     "test@example.com",
				Role:      "ADMIN",
				SessionID: 1,
			}
			ctx := context.WithValue(r.Context(), middleware.UserContextKey, u)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})

	registerDomainRoutes := func(sub chi.Router) {
		authHandler.RegisterRoutes(sub)
		usersHandler.RegisterRoutes(sub)
		matchingHandler.RegisterRoutes(sub)
		recommendedHandler.RegisterRoutes(sub)
		friendsHandler.RegisterRoutes(sub)
		chatHandler.RegisterRoutes(sub)
		mediaHandler.RegisterRoutes(sub)
		notificationsHandler.RegisterRoutes(sub)
		questionsHandler.RegisterRoutes(sub)
		interestsHandler.RegisterRoutes(sub)
		adminHandler.RegisterRoutes(sub)
		systemHandler.RegisterRoutes(sub)
		geoHandler.RegisterRoutes(sub)
	}

	// Register version-neutral routes
	registerDomainRoutes(r)

	// Register /v1 prefixed routes
	r.Route("/v1", func(v1 chi.Router) {
		registerDomainRoutes(v1)
	})

	return r
}

func TestRouteParity(t *testing.T) {
	router := setupRealRouter()

	for _, ep := range allRouteEndpoints {
		// 1. Test version-neutral route
		req := httptest.NewRequest(ep.Method, ep.Path, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code == http.StatusNotFound {
			t.Errorf("version-neutral endpoint %s %s returned 404 Not Found", ep.Method, ep.Path)
		}

		// 2. Test /v1/ prefixed route
		v1Path := "/v1" + ep.Path
		v1Req := httptest.NewRequest(ep.Method, v1Path, nil)
		v1W := httptest.NewRecorder()
		router.ServeHTTP(v1W, v1Req)
		if v1W.Code == http.StatusNotFound {
			t.Errorf("v1 endpoint %s %s returned 404 Not Found", ep.Method, v1Path)
		}
	}
}
