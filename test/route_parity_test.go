package test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

// List of all authoritative endpoints from datemate-api.json
var openAPIEndpoints = []struct {
	Method string
	Path   string
}{
	{"GET", "/health"},
	{"GET", "/time"},
	{"POST", "/auth/signup"},
	{"POST", "/auth/signin"},
	{"POST", "/auth/refresh"},
	{"POST", "/auth/forgot-password"},
	{"POST", "/auth/reset-password"},
	{"POST", "/auth/google"},
	{"POST", "/auth/apple"},
	{"POST", "/auth/logout"},
	{"GET", "/feed"},
	{"POST", "/swipes"},
	{"GET", "/matches"},
	{"GET", "/likes"},
	{"GET", "/recommended"},
	{"GET", "/recommended/detail"},
	{"GET", "/questions"},
	{"GET", "/questions/1"},
	{"GET", "/interests"},
	{"GET", "/interests/1"},
	{"GET", "/interest"},
	{"GET", "/users/profile"},
	{"PUT", "/users/profile"},
	{"GET", "/users/me"},
	{"GET", "/users/1"},
	{"DELETE", "/users/account"},
	{"GET", "/users/devices"},
	{"DELETE", "/users/gallery/1"},
	{"GET", "/admin/dashboard/stats"},
	{"GET", "/admin/dashboard/overview"},
	{"GET", "/admin/users"},
	{"GET", "/admin/users/1"},
	{"POST", "/admin/users/1/ban"},
	{"POST", "/admin/users/1/unban"},
	{"GET", "/admin/verifications"},
	{"POST", "/admin/verifications/1/approve"},
	{"POST", "/admin/verifications/1/reject"},
	{"GET", "/assets/images/sample.jpg"},
	{"GET", "/assets/avatars/sample.jpg"},
	{"GET", "/assets/icons/sample.svg"},
	{"GET", "/rules"},
	{"GET", "/docs/rules"},
}

func dummyHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

func setupTestRouter() *chi.Mux {
	r := chi.NewRouter()

	registerRoutes := func(router chi.Router) {
		// System
		router.Get("/health", dummyHandler)
		router.Get("/time", dummyHandler)
		router.Get("/rules", dummyHandler)
		router.Get("/docs/rules", dummyHandler)

		// Auth
		router.Route("/auth", func(a chi.Router) {
			a.Post("/signup", dummyHandler)
			a.Post("/verify", dummyHandler)
			a.Post("/signin", dummyHandler)
			a.Post("/refresh", dummyHandler)
			a.Post("/forgot-password", dummyHandler)
			a.Post("/reset-password", dummyHandler)
			a.Post("/nonce", dummyHandler)
			a.Post("/google", dummyHandler)
			a.Post("/apple", dummyHandler)
			a.Post("/logout", dummyHandler)
		})

		// Feed, Matching, Recommended
		router.Get("/feed", dummyHandler)
		router.Post("/swipes", dummyHandler)
		router.Get("/matches", dummyHandler)
		router.Get("/likes", dummyHandler)
		router.Get("/recommended", dummyHandler)
		router.Get("/recommended/detail", dummyHandler)

		// Questions & Interests
		router.Get("/questions", dummyHandler)
		router.Get("/questions/{id}", dummyHandler)
		router.Get("/questions/search", dummyHandler)
		router.Get("/questions/type/{type}", dummyHandler)
		router.Get("/interests", dummyHandler)
		router.Get("/interests/{id}", dummyHandler)
		router.Get("/interest", dummyHandler)
		router.Get("/interest/{id}", dummyHandler)

		// Users
		router.Route("/users", func(u chi.Router) {
			u.Get("/profile", dummyHandler)
			u.Post("/profile", dummyHandler)
			u.Put("/profile", dummyHandler)
			u.Get("/me", dummyHandler)
			u.Get("/bulk", dummyHandler)
			u.Delete("/account", dummyHandler)
			u.Get("/devices", dummyHandler)
			u.Delete("/devices/{deviceId}", dummyHandler)
			u.Put("/device-token", dummyHandler)
			u.Get("/{userId}/device-token", dummyHandler)
			u.Delete("/gallery/{galleryId}", dummyHandler)
			u.Get("/{id}", dummyHandler)
		})

		// Assets & Media
		router.Get("/assets/{type}/{filename}", dummyHandler)
		router.Post("/assets/upload/{type}", dummyHandler)
		router.Get("/media/types", dummyHandler)
		router.Post("/media/upload/{type}", dummyHandler)

		// Admin
		router.Route("/admin", func(adm chi.Router) {
			adm.Get("/dashboard/stats", dummyHandler)
			adm.Get("/dashboard/overview", dummyHandler)
			adm.Get("/users", dummyHandler)
			adm.Get("/users/count", dummyHandler)
			adm.Get("/users/pending-selfies/count", dummyHandler)
			adm.Get("/users/{id}", dummyHandler)
			adm.Post("/users/{id}/ban", dummyHandler)
			adm.Post("/users/{id}/unban", dummyHandler)
			adm.Get("/users/{userId}/devices", dummyHandler)
			adm.Delete("/users/{userId}/devices/{deviceId}", dummyHandler)
			adm.Delete("/users/{userId}/gallery/{galleryId}", dummyHandler)
			adm.Get("/verifications", dummyHandler)
			adm.Get("/verifications/count", dummyHandler)
			adm.Get("/verifications/pending/count", dummyHandler)
			adm.Post("/verifications/{id}/approve", dummyHandler)
			adm.Post("/verifications/{id}/reject", dummyHandler)
		})
	}

	registerRoutes(r)
	r.Route("/v1", func(v1 chi.Router) {
		registerRoutes(v1)
	})

	return r
}

func TestRouteParity(t *testing.T) {
	router := setupTestRouter()

	for _, ep := range openAPIEndpoints {
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
