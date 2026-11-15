package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"datemate/internal/config"
)

func TestApiKeyGuard(t *testing.T) {
	cfg := &config.Config{
		InternalAPIKey: "secret-internal-key",
	}

	guard := ApiKeyGuard(cfg)
	dummyHandler := guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	// 1. Missing header -> 401 Unauthorized
	req1 := httptest.NewRequest("GET", "/test", nil)
	w1 := httptest.NewRecorder()
	dummyHandler.ServeHTTP(w1, req1)
	if w1.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for missing key, got %d", w1.Code)
	}

	// 2. Invalid header -> 401 Unauthorized (NOT 403)
	req2 := httptest.NewRequest("GET", "/test", nil)
	req2.Header.Set("x-api-key", "wrong-key")
	w2 := httptest.NewRecorder()
	dummyHandler.ServeHTTP(w2, req2)
	if w2.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for invalid key, got %d", w2.Code)
	}

	// 3. Valid x-api-key header -> 200 OK
	req3 := httptest.NewRequest("GET", "/test", nil)
	req3.Header.Set("x-api-key", "secret-internal-key")
	w3 := httptest.NewRecorder()
	dummyHandler.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Errorf("expected 200 for valid x-api-key, got %d", w3.Code)
	}

	// 4. Valid x-api-token header -> 200 OK
	req4 := httptest.NewRequest("GET", "/test", nil)
	req4.Header.Set("x-api-token", "secret-internal-key")
	w4 := httptest.NewRecorder()
	dummyHandler.ServeHTTP(w4, req4)
	if w4.Code != http.StatusOK {
		t.Errorf("expected 200 for valid x-api-token, got %d", w4.Code)
	}

	// 5. Valid query param api_key -> 200 OK
	req5 := httptest.NewRequest("GET", "/test?api_key=secret-internal-key", nil)
	w5 := httptest.NewRecorder()
	dummyHandler.ServeHTTP(w5, req5)
	if w5.Code != http.StatusOK {
		t.Errorf("expected 200 for valid api_key query param, got %d", w5.Code)
	}

	// 6. Valid Authorization: Bearer <key> -> 200 OK
	req6 := httptest.NewRequest("GET", "/test", nil)
	req6.Header.Set("Authorization", "Bearer secret-internal-key")
	w6 := httptest.NewRecorder()
	dummyHandler.ServeHTTP(w6, req6)
	if w6.Code != http.StatusOK {
		t.Errorf("expected 200 for valid Bearer key, got %d", w6.Code)
	}
}

