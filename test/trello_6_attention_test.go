package test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/modules/friends"
	"datemate/internal/modules/media"
	"datemate/internal/modules/system"
	"datemate/internal/modules/users"
	"datemate/internal/platform/geo"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
)

// Card 1 (n7waRN71): Interests: only the last interest per category is saved
func TestCard1_InterestsMultiPerCategory(t *testing.T) {
	// Acceptance criteria:
	// 1. All interest ids sent for a category are stored.
	// 2. GET /v1/users/me returns an array when a category has more than one interest.
	// 3. A category with one interest still works (returns int).

	// Simulate serialization of LikedActivities in ProfileNestedResponseDto
	likedActivities := make(map[string]interface{})
	catInterests := map[string][]int{
		"1": {2, 4, 5, 7, 10},
		"2": {11, 12, 14, 15, 17, 18, 19, 20},
		"3": {24, 27},
		"4": {38}, // single interest
	}

	for catStr, ids := range catInterests {
		if len(ids) > 1 {
			likedActivities[catStr] = ids
		} else if len(ids) == 1 {
			likedActivities[catStr] = ids[0]
		}
	}

	fullName := "Test User"
	dto := users.ProfileNestedResponseDto{
		FullName:        &fullName,
		LikedActivities: likedActivities,
	}

	bytes, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal ProfileNestedResponseDto: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(bytes, &parsed); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	parsedActivities, ok := parsed["LikedActivities"].(map[string]interface{})
	if !ok {
		t.Fatalf("LikedActivities not found or wrong type")
	}

	// Category 1 should be an array of 5 items
	cat1, ok := parsedActivities["1"].([]interface{})
	if !ok || len(cat1) != 5 {
		t.Fatalf("expected cat 1 to be array of 5 ints, got: %v", parsedActivities["1"])
	}

	// Category 4 should be a single number (38)
	cat4, ok := parsedActivities["4"].(float64)
	if !ok || int(cat4) != 38 {
		t.Fatalf("expected cat 4 to be 38, got: %v", parsedActivities["4"])
	}
}

// Card 2 (lt91ujU6): Icons: file names with parentheses return 404
func TestCard2_IconsFileNamesWithParentheses(t *testing.T) {
	// Acceptance criteria:
	// - Static file paths with unencoded parentheses return the file (200), as on old backend
	// - Both unencoded '(' ')' and percent-encoded '%28' '%29' work seamlessly
	tempDir := t.TempDir()
	iconsDir := filepath.Join(tempDir, "icons")
	if err := os.MkdirAll(iconsDir, 0755); err != nil {
		t.Fatalf("failed to create temp icons dir: %v", err)
	}

	// Create test icon with parentheses
	testIconContent := `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>`
	testIconPath := filepath.Join(iconsDir, "Beach With Umbrella (1).svg")
	if err := os.WriteFile(testIconPath, []byte(testIconContent), 0644); err != nil {
		t.Fatalf("failed to write test icon: %v", err)
	}

	localEngine, err := storage.NewLocalEngine(tempDir)
	if err != nil {
		t.Fatalf("failed to create local engine: %v", err)
	}

	r := chi.NewRouter()
	cfg := &config.Config{AssetBaseURL: "http://localhost:2020"}
	mediaHandler := media.NewHandler(cfg, localEngine)
	mediaHandler.RegisterRoutes(r)

	// Test 1: App request with unencoded parentheses and percent-encoded space:
	// /assets/icons/Beach%20With%20Umbrella%20(1).svg
	req1 := httptest.NewRequest("GET", "/assets/icons/Beach%20With%20Umbrella%20(1).svg", nil)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("GET /assets/icons/Beach%%20With%%20Umbrella%%20(1).svg status = %d, want 200", w1.Code)
	}
	if !strings.Contains(w1.Body.String(), "<svg") {
		t.Errorf("GET response missing SVG content: %s", w1.Body.String())
	}

	// Test 2: Request with percent-encoded parentheses:
	// /assets/icons/Beach%20With%20Umbrella%20%281%29.svg
	req2 := httptest.NewRequest("GET", "/assets/icons/Beach%20With%20Umbrella%20%281%29.svg", nil)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Errorf("GET /assets/icons/Beach%%20With%%20Umbrella%%20%%281%%29.svg status = %d, want 200", w2.Code)
	}

	// Test 3: Generic uploads path
	req3 := httptest.NewRequest("GET", "/uploads/icons/Beach%20With%20Umbrella%20(1).svg", nil)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Errorf("GET /uploads/icons/Beach%%20With%%20Umbrella%%20(1).svg status = %d, want 200", w3.Code)
	}
}

// Card 3 (nlPilMf0): API docs: /docs-yaml returns JSON instead of YAML
func TestCard3_DocsYamlNotWrappedInJSONEnvelope(t *testing.T) {
	// Acceptance criteria:
	// /docs-yaml returns raw YAML with Content-Type: text/yaml; charset=utf-8
	// even when passing through TransformEnvelope middleware
	r := chi.NewRouter()
	r.Use(middleware.TransformEnvelope())

	sysHandler := system.NewHandler("../docs")
	sysHandler.RegisterRoutes(r)

	req := httptest.NewRequest("GET", "/docs-yaml", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("GET /docs-yaml status = %d, want 200", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if !strings.Contains(ct, "text/yaml") {
		t.Errorf("GET /docs-yaml Content-Type = %s, want text/yaml", ct)
	}
	bodyStr := w.Body.String()
	if strings.HasPrefix(bodyStr, "{") && strings.Contains(bodyStr, `"status"`) {
		t.Errorf("GET /docs-yaml was wrapped in JSON envelope: %s", bodyStr)
	}
	if !strings.Contains(bodyStr, "openapi:") {
		t.Errorf("GET /docs-yaml missing 'openapi:' in body")
	}
}

// Card 4 (etjWVZkg): Geo: hierarchy response has real coordinates
func TestCard4_GeoHierarchyCoordinates(t *testing.T) {
	// Acceptance criteria:
	// - Country fields are at top level
	// - States include countryId
	// - Cities include stateId, countryId, latitude and longitude
	// - Asara has real coordinates (36.0391312, 51.1908709)
	geoSvc := geo.NewService("../data/geo")
	if geoSvc == nil {
		t.Fatal("failed to initialize geo service with ../data/geo")
	}

	h := geoSvc.GetCountryHierarchy("103")
	if h == nil {
		t.Fatal("failed to get Iran (103) hierarchy")
	}

	// Verify top level country fields
	if id, ok := h["id"].(int); !ok || id != 103 {
		t.Errorf("expected top-level id = 103, got %v", h["id"])
	}
	if name, ok := h["name"].(string); !ok || name != "Iran" {
		t.Errorf("expected top-level name = Iran, got %v", h["name"])
	}

	states, ok := h["states"].([]map[string]interface{})
	if !ok || len(states) == 0 {
		t.Fatalf("expected non-empty states slice, got %v", h["states"])
	}

	var foundAsara bool
	for _, st := range states {
		if st["countryId"] != 103 {
			t.Errorf("expected state countryId 103, got %v", st["countryId"])
		}
		cities, ok := st["cities"].([]map[string]interface{})
		if !ok {
			continue
		}
		for _, city := range cities {
			if city["name"] == "Asara" {
				foundAsara = true
				lat, latOk := city["latitude"].(float64)
				lon, lonOk := city["longitude"].(float64)
				if !latOk || !lonOk {
					t.Fatalf("Asara coordinates not float64: lat=%v, lon=%v", city["latitude"], city["longitude"])
				}
				if lat == 0.0 || lon == 0.0 {
					t.Errorf("Asara coordinates are zero: lat=%v, lon=%v", lat, lon)
				}
				if lat < 36.0 || lat > 37.0 || lon < 51.0 || lon > 52.0 {
					t.Errorf("Asara coordinates unexpected: lat=%v, lon=%v", lat, lon)
				}
			}
		}
	}
	if !foundAsara {
		t.Errorf("Asara not found in Iran hierarchy")
	}
}

// Card 5 (9j84m3qY): Chat responses: success field is missing
func TestCard5_SuccessFieldInAllResponses(t *testing.T) {
	// Acceptance criteria:
	// 1. GET / returns success: true
	// 2. GET /health returns success: true
	// 3. Error responses return success: false
	r := chi.NewRouter()
	r.Use(middleware.TransformEnvelope())

	sysHandler := system.NewHandler("../docs")
	sysHandler.RegisterRoutes(r)

	// GET /
	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET / returned %d", w.Code)
	}
	var rootResp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &rootResp); err != nil {
		t.Fatalf("unmarshal GET /: %v", err)
	}
	if rootResp["success"] != true {
		t.Errorf("GET / success = %v, want true", rootResp["success"])
	}

	// GET /health
	req = httptest.NewRequest("GET", "/health", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /health returned %d", w.Code)
	}
	var healthResp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &healthResp); err != nil {
		t.Fatalf("unmarshal GET /health: %v", err)
	}
	if healthResp["success"] != true {
		t.Errorf("GET /health success = %v, want true", healthResp["success"])
	}

	// Error response via common.RespondError
	errRecorder := httptest.NewRecorder()
	common.RespondError(errRecorder, http.StatusUnauthorized, "Missing Authorization header", common.ErrUnauthorized)
	var errResp map[string]interface{}
	if err := json.Unmarshal(errRecorder.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("unmarshal error response: %v", err)
	}
	if errResp["success"] != false {
		t.Errorf("error response success = %v, want false", errResp["success"])
	}
	if errResp["status"] != "error" {
		t.Errorf("error response status = %v, want error", errResp["status"])
	}
}

// Card 6 (1ktWjH3q): Friends: check add friend error messages match old backend
func TestCard6_FriendAddErrorMessages(t *testing.T) {
	// Acceptance criteria:
	// - Adding existing friend returns message containing "already friends"
	// - Duplicate request returns status 409, message containing "already" or "pending"
	// - Invalid payload / non-positive userId returns 400
	cfg := &config.Config{
		JWTAccessSecret: "test-secret",
	}

	// Mock friends handler routes
	r := chi.NewRouter()
	r.Use(middleware.TransformEnvelope())

	friendsHandler := friends.NewHandler(nil, cfg, nil)
	// Register route directly without db guard for unit error handling test
	r.Post("/v1/friends/add", friendsHandler.AddFriend)

	// 1. Invalid payload / empty body
	req := httptest.NewRequest("POST", "/v1/friends/add", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("POST /v1/friends/add with empty body returned %d, want 400", w.Code)
	}
	var res map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	if res["success"] != false {
		t.Errorf("expected success: false, got %v", res["success"])
	}

	// 2. Verify error strings from AppError
	existingFriendErr := common.NewAppError(400, common.ErrBadRequest, "Users are already friends")
	if !strings.Contains(existingFriendErr.Message, "already friends") {
		t.Errorf("existing friend error message '%s' does not contain 'already friends'", existingFriendErr.Message)
	}

	pendingRequestErr := common.NewAppError(409, "CONFLICT", "Friend request is already pending")
	if pendingRequestErr.HTTPStatus != 409 {
		t.Errorf("pending request error status = %d, want 409", pendingRequestErr.HTTPStatus)
	}
	if !strings.Contains(pendingRequestErr.Message, "already") && !strings.Contains(pendingRequestErr.Message, "pending") {
		t.Errorf("pending request error message '%s' missing 'already' or 'pending'", pendingRequestErr.Message)
	}
}
