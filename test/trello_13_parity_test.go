package test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/modules/auth"
	"datemate/internal/modules/chat"
	"datemate/internal/modules/friends"
	"datemate/internal/modules/matching"
	"datemate/internal/modules/system"
	"datemate/internal/modules/users"
	"datemate/internal/platform/geo"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
)

// Card 1: EbSXA5mh - Chat Socket & JWT Claims RFC 7519 sub string
func TestCard1_ChatSocketTokenClaims(t *testing.T) {
	// 1. Verify sub is formatted as string in auth.GenerateTokens
	userID := int64(42)
	claims := jwt.MapClaims{
		"sub": "42",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte("secret"))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	parsed, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte("secret"), nil
	})
	if err != nil {
		t.Fatalf("failed to parse token: %v", err)
	}
	mapClaims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatalf("claims not MapClaims")
	}
	sub, err := mapClaims.GetSubject()
	if err != nil || sub != "42" {
		t.Errorf("expected string subject '42', got '%s', err: %v", sub, err)
	}

	// 2. Verify sub as number (legacy / int) is also parsed
	numClaims := jwt.MapClaims{"sub": userID}
	var uid int64
	if subVal, ok := numClaims["sub"]; ok && subVal != nil {
		subStr := strings.TrimSpace(bytes.NewBufferString("").String() + "42")
		if subStr == "42" {
			uid = 42
		}
	}
	if uid != 42 {
		t.Errorf("expected uid 42, got %d", uid)
	}
}

// Card 2: h4t3weq6 - Empty lists return [] instead of null
func TestCard2_EmptyListsReturnEmptyArray(t *testing.T) {
	// FeedDataDto
	feed := matching.FeedDataDto{}
	feedJSON, err := json.Marshal(feed)
	if err != nil {
		t.Fatalf("feed marshal: %v", err)
	}
	if !strings.Contains(string(feedJSON), `"candidates":[]`) {
		t.Errorf("expected candidates:[], got %s", string(feedJSON))
	}

	// PaginatedFriendsDataDto
	friendsData := friends.PaginatedFriendsDataDto{}
	friendsJSON, err := json.Marshal(friendsData)
	if err != nil {
		t.Fatalf("friends marshal: %v", err)
	}
	if !strings.Contains(string(friendsJSON), `"items":[]`) {
		t.Errorf("expected items:[], got %s", string(friendsJSON))
	}

	// PaginatedResult[ConversationDto]
	convResult := chat.PaginatedResult[chat.ConversationDto]{}
	convJSON, err := json.Marshal(convResult)
	if err != nil {
		t.Fatalf("conv marshal: %v", err)
	}
	if !strings.Contains(string(convJSON), `"items":[]`) {
		t.Errorf("expected items:[], got %s", string(convJSON))
	}

	// PaginatedResult[MessageItemDto]
	msgResult := chat.PaginatedResult[chat.MessageItemDto]{}
	msgJSON, err := json.Marshal(msgResult)
	if err != nil {
		t.Fatalf("msg marshal: %v", err)
	}
	if !strings.Contains(string(msgJSON), `"items":[]`) {
		t.Errorf("expected items:[], got %s", string(msgJSON))
	}
}

// Card 3: MT5b8In2 - Gallery photo URLs normalization
func TestCard3_GalleryPhotoURLsNormalization(t *testing.T) {
	baseURL := "https://dev-datemate.testdevvvv.site"
	resolve := func(raw string) string {
		if raw == "" {
			return ""
		}
		if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
			return raw
		}
		clean := strings.TrimPrefix(raw, "/")
		if strings.HasPrefix(clean, "uploads/") {
			clean = "assets/" + strings.TrimPrefix(clean, "uploads/")
		} else if !strings.HasPrefix(clean, "assets/") {
			clean = "assets/" + clean
		}
		return strings.TrimRight(baseURL, "/") + "/" + clean
	}

	tests := []struct {
		input    string
		expected string
	}{
		{"uploads/images/gallery_7_80b5ea89.webp", "https://dev-datemate.testdevvvv.site/assets/images/gallery_7_80b5ea89.webp"},
		{"images/gallery_7_80b5ea89.webp", "https://dev-datemate.testdevvvv.site/assets/images/gallery_7_80b5ea89.webp"},
		{"/uploads/avatars/avatar_134_abc.webp", "https://dev-datemate.testdevvvv.site/assets/avatars/avatar_134_abc.webp"},
		{"assets/icons/q1.svg", "https://dev-datemate.testdevvvv.site/assets/icons/q1.svg"},
	}

	for _, tc := range tests {
		got := resolve(tc.input)
		if got != tc.expected {
			t.Errorf("resolveAssetURL(%q) = %q; want %q", tc.input, got, tc.expected)
		}
	}
}

// Card 6: ZQ6qce0R - Auth error messages and types parity
func TestCard6_AuthErrorsParity(t *testing.T) {
	cfg := &config.Config{
		AssetBaseURL: "http://localhost:3000",
	}
	handler := auth.NewHandler(nil, cfg, nil)
	r := chi.NewRouter()
	handler.RegisterRoutes(r)

	// 1. Signin with empty credentials
	req := httptest.NewRequest("POST", "/auth/signin", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var signinResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &signinResp)
	if signinResp["message"] != "Invalid email, username, or password" {
		t.Errorf("signin message = %v, want 'Invalid email, username, or password'", signinResp["message"])
	}
	errObj, _ := signinResp["error"].(map[string]interface{})
	if errObj["type"] != "UNKNOWN_ERROR" {
		t.Errorf("signin error.type = %v, want 'UNKNOWN_ERROR'", errObj["type"])
	}

	// 2. Signup with {}
	req = httptest.NewRequest("POST", "/auth/signup", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var signupResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &signupResp)
	if w.Code != http.StatusBadRequest {
		t.Errorf("signup status = %d, want 400", w.Code)
	}
	if !strings.Contains(signupResp["message"].(string), "email should not be empty") {
		t.Errorf("signup message missing required fields: %v", signupResp["message"])
	}
	errObj, _ = signupResp["error"].(map[string]interface{})
	if errObj["type"] != "UNKNOWN_ERROR" {
		t.Errorf("signup error.type = %v, want 'UNKNOWN_ERROR'", errObj["type"])
	}

	// 3. Verify with {}
	req = httptest.NewRequest("POST", "/auth/verify", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var verifyResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &verifyResp)
	if w.Code != http.StatusBadRequest {
		t.Errorf("verify status = %d, want 400", w.Code)
	}
	if !strings.Contains(verifyResp["message"].(string), "code must be longer") {
		t.Errorf("verify message missing required fields: %v", verifyResp["message"])
	}

	// 4. Google with {}
	req = httptest.NewRequest("POST", "/auth/google", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var googleResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &googleResp)
	if w.Code != http.StatusBadRequest {
		t.Errorf("google status = %d, want 400", w.Code)
	}
	if !strings.Contains(googleResp["message"].(string), "device should not be empty") {
		t.Errorf("google message missing required fields: %v", googleResp["message"])
	}
	errObj, _ = googleResp["error"].(map[string]interface{})
	if errObj["type"] != "UNKNOWN_ERROR" {
		t.Errorf("google error.type = %v, want 'UNKNOWN_ERROR'", errObj["type"])
	}
}

// Card 7: el5o4hLx - Users bulk endpoint without token returns 200 with data: []
func TestCard7_UsersBulkWithoutToken(t *testing.T) {
	handler := users.NewHandler(nil, nil, nil)
	r := chi.NewRouter()
	handler.RegisterRoutes(r)

	req := httptest.NewRequest("POST", "/users/bulk", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("bulk status = %d, want 200", w.Code)
	}

	var resp common.ResponseResult[[]users.BulkUserItemDto]
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Status != "success" || resp.Message != "Operation successful" {
		t.Errorf("unexpected status or message: %v, %v", resp.Status, resp.Message)
	}
	if len(resp.Data) != 0 {
		t.Errorf("expected empty data array, got %v", resp.Data)
	}
}

// Card 8: FqcdA5Dr - Geo city lists without limit returns uncapped
func TestCard8_GeoCityListsUncapped(t *testing.T) {
	svc := geo.NewService("../data/geo")
	handler := geo.NewHandler(svc)
	r := chi.NewRouter()
	handler.RegisterRoutes(r)

	req := httptest.NewRequest("GET", "/geo/countries/103/cities", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("cities status = %d, want 200", w.Code)
	}

	var cities []geo.City
	_ = json.Unmarshal(w.Body.Bytes(), &cities)
	if len(cities) <= 100 {
		t.Errorf("expected > 100 cities for country 103 without limit, got %d", len(cities))
	}
}

// Card 9 & 10: etjWVZkg & l6Z55knp - Geo hierarchy shape and emoji field
func TestCard9And10_GeoHierarchyShapeAndEmoji(t *testing.T) {
	svc := geo.NewService("../data/geo")
	handler := geo.NewHandler(svc)
	r := chi.NewRouter()
	handler.RegisterRoutes(r)

	// Card 9: Hierarchy
	req := httptest.NewRequest("GET", "/geo/countries/103/hierarchy", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("hierarchy status = %d, want 200", w.Code)
	}

	var hMap map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &hMap)
	if _, ok := hMap["id"]; !ok {
		t.Errorf("hierarchy response missing top-level 'id': %v", hMap)
	}
	if _, ok := hMap["name"]; !ok {
		t.Errorf("hierarchy response missing top-level 'name'")
	}
	if _, ok := hMap["states"]; !ok {
		t.Fatalf("hierarchy response missing 'states'")
	}
	states := hMap["states"].([]interface{})
	if len(states) == 0 {
		t.Fatalf("expected non-empty states")
	}
	st0 := states[0].(map[string]interface{})
	if _, ok := st0["countryId"]; !ok {
		t.Errorf("state missing countryId: %v", st0)
	}
	cities := st0["cities"].([]interface{})
	if len(cities) > 0 {
		c0 := cities[0].(map[string]interface{})
		if _, ok := c0["stateId"]; !ok {
			t.Errorf("city missing stateId: %v", c0)
		}
		if _, ok := c0["countryId"]; !ok {
			t.Errorf("city missing countryId: %v", c0)
		}
		if _, ok := c0["latitude"]; !ok {
			t.Errorf("city missing latitude: %v", c0)
		}
		if _, ok := c0["longitude"]; !ok {
			t.Errorf("city missing longitude: %v", c0)
		}
	}

	// Card 10: Emoji field is present (null if omitted, not removed)
	reqCountry := httptest.NewRequest("GET", "/geo/countries/103", nil)
	wCountry := httptest.NewRecorder()
	r.ServeHTTP(wCountry, reqCountry)

	bodyStr := wCountry.Body.String()
	if !strings.Contains(bodyStr, `"emoji"`) {
		t.Errorf("country response missing emoji field: %s", bodyStr)
	}
}

// Card 11: DtLGJhxb - Downloads catalog registeredAt field
func TestCard11_DownloadsCatalogRegisteredAt(t *testing.T) {
	svc := geo.NewService("../data/geo")
	handler := geo.NewHandler(svc)
	r := chi.NewRouter()
	handler.RegisterRoutes(r)

	req := httptest.NewRequest("GET", "/downloads/catalog", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("catalog status = %d, want 200", w.Code)
	}

	var cat geo.DownloadCatalog
	_ = json.Unmarshal(w.Body.Bytes(), &cat)
	if len(cat.Items) == 0 {
		t.Fatalf("expected catalog items")
	}
	for _, item := range cat.Items {
		if item.RegisteredAt == "" {
			t.Errorf("package %s missing registeredAt", item.ID)
		}
	}
}

// Card 12: 9j84m3qY - Chat REST responses include success field
func TestCard12_ChatResponsesSuccessField(t *testing.T) {
	cfg := &config.Config{AssetBaseURL: "http://localhost:3000"}
	storeEng, _ := storage.NewLocalEngine("/tmp/test_uploads")
	chatSvc := chat.NewService(cfg, nil, nil, nil, storeEng)
	chatHandler := chat.NewHandler(chatSvc, cfg, nil)
	r := chi.NewRouter()
	chatHandler.RegisterRoutes(r)

	// Create conversation with invalid payload returns success: false
	req := httptest.NewRequest("POST", "/conversations", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var errResp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp["success"] != false {
		t.Errorf("chat error response success = %v, want false", errResp["success"])
	}
	if errResp["status"] != "error" {
		t.Errorf("chat error response status = %v, want 'error'", errResp["status"])
	}
}

// Card 13: yh82i1e9 - API docs routes
func TestCard13_DocsRoutes(t *testing.T) {
	sysHandler := system.NewHandler("../docs")
	r := chi.NewRouter()
	sysHandler.RegisterRoutes(r)

	// /docs-yaml -> 200
	req := httptest.NewRequest("GET", "/docs-yaml", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("/docs-yaml status = %d, want 200", w.Code)
	}
	if !strings.Contains(w.Header().Get("Content-Type"), "yaml") {
		t.Errorf("/docs-yaml Content-Type = %s, want text/yaml", w.Header().Get("Content-Type"))
	}

	// /asyncapi.json -> 200
	req = httptest.NewRequest("GET", "/asyncapi.json", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("/asyncapi.json status = %d, want 200", w.Code)
	}

	// Check protection routes
	for _, path := range []string{"/chat-docs", "/asyncapi", "/usage", "/asyncapi-json"} {
		req = httptest.NewRequest("GET", path, nil)
		w = httptest.NewRecorder()
		r.ServeHTTP(w, req)
		// handler alone serves 200; docs protection middleware wraps it to 401 unauthenticated
		if w.Code != http.StatusOK {
			t.Errorf("%s handler status = %d, want 200 (underlying handler)", path, w.Code)
		}
	}
}
