package chat_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

func TestChiTrailingSlashWithSubrouter(t *testing.T) {
	r := chi.NewRouter()
	r.Use(chiMiddleware.CleanPath)
	r.Use(chiMiddleware.StripSlashes)

	r.Get("/conversations", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("root conversations"))
	})
	r.Get("/conversations/group", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("root group conversations"))
	})

	r.Route("/v1", func(v1 chi.Router) {
		v1.Use(chiMiddleware.StripSlashes)
		v1.Get("/conversations", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("v1 conversations"))
		})
		v1.Get("/conversations/group", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("v1 group conversations"))
		})
		v1.Get("/conversations/groups", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("v1 group conversations"))
		})
		v1.Get("/conversations/{conversationId}", func(w http.ResponseWriter, r *http.Request) {
			id := chi.URLParam(r, "conversationId")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("conv details: " + id))
		})
	})

	tests := []struct {
		url      string
		expected int
		body     string
	}{
		{"/conversations", 200, "root conversations"},
		{"/conversations/", 200, "root conversations"},
		{"/conversations/group", 200, "root group conversations"},
		{"/conversations/group/", 200, "root group conversations"},
		{"/v1/conversations", 200, "v1 conversations"},
		{"/v1/conversations/", 200, "v1 conversations"},
		{"/v1/conversations/group", 200, "v1 group conversations"},
		{"/v1/conversations/group/", 200, "v1 group conversations"},
		{"/v1/conversations/groups", 200, "v1 group conversations"},
		{"/v1/conversations/groups/", 200, "v1 group conversations"},
		{"/v1/conversations/550e8400-e29b-41d4-a716-446655440000", 200, "conv details: 550e8400-e29b-41d4-a716-446655440000"},
		{"/v1/conversations/550e8400-e29b-41d4-a716-446655440000/", 200, "conv details: 550e8400-e29b-41d4-a716-446655440000"},
	}

	for _, tc := range tests {
		req := httptest.NewRequest("GET", tc.url, nil)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != tc.expected {
			t.Errorf("Path %s got status %d, expected %d", tc.url, rec.Code, tc.expected)
		}
		if rec.Body.String() != tc.body {
			t.Errorf("Path %s got body %q, expected %q", tc.url, rec.Body.String(), tc.body)
		}
	}
}
