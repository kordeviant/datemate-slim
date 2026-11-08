package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/modules/chat"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
)

// Card EikSo6Yu: Chat: creating a direct conversation rejects participantIds
func TestTrello_DirectConversationParticipantIdsResolution(t *testing.T) {
	cfg := &config.Config{AssetBaseURL: "http://localhost:3000"}
	storeEng, _ := storage.NewLocalEngine(t.TempDir())
	chatSvc := chat.NewService(cfg, nil, nil, nil, storeEng)
	chatHandler := chat.NewHandler(chatSvc, cfg, nil)

	r := chi.NewRouter()
	r.Use(middleware.TransformEnvelope())

	// Middleware to inject authenticated user (u.ID = 12)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			authUser := &middleware.AuthUser{
				ID:        12,
				Email:     "user12@example.com",
				Role:      "USER",
				SessionID: 1,
			}
			ctx := context.WithValue(req.Context(), middleware.UserContextKey, authUser)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})

	chatHandler.RegisterRoutes(r)

	// Test 1: iOS App exact payload: { "participantIds": [11], "type": "direct" }
	body1 := `{"participantIds": [11], "type": "direct"}`
	req1 := httptest.NewRequest("POST", "/conversations", bytes.NewBufferString(body1))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for {participantIds: [11], type: direct}, got %d: %s", w1.Code, w1.Body.String())
	}
	var res1 map[string]interface{}
	_ = json.Unmarshal(w1.Body.Bytes(), &res1)
	if res1["success"] != true {
		t.Errorf("expected success: true, got %v", res1["success"])
	}
	data1, _ := res1["data"].(map[string]interface{})
	conv1, _ := data1["conversation"].(map[string]interface{})
	if conv1["type"] != "direct" {
		t.Errorf("expected type direct, got %v", conv1["type"])
	}

	// Test 2: Payload with both caller and target: { "participantIds": [12, 11], "type": "direct" }
	body2 := `{"participantIds": [12, 11], "type": "direct"}`
	req2 := httptest.NewRequest("POST", "/conversations", bytes.NewBufferString(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for {participantIds: [12, 11], type: direct}, got %d: %s", w2.Code, w2.Body.String())
	}

	// Test 3: Self-conversation: { "participantIds": [12], "type": "direct" }
	// Must return 400 Bad Request with Self-conversation not allowed
	body3 := `{"participantIds": [12], "type": "direct"}`
	req3 := httptest.NewRequest("POST", "/conversations", bytes.NewBufferString(body3))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)

	if w3.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for self-conversation, got %d", w3.Code)
	}
	var res3 map[string]interface{}
	_ = json.Unmarshal(w3.Body.Bytes(), &res3)
	if res3["message"] != "Self-conversation is not allowed" {
		t.Errorf("expected 'Self-conversation is not allowed', got %v", res3["message"])
	}

	// Test 4: Missing target and participantIds: { "type": "direct" }
	body4 := `{"type": "direct"}`
	req4 := httptest.NewRequest("POST", "/conversations", bytes.NewBufferString(body4))
	req4.Header.Set("Content-Type", "application/json")
	w4 := httptest.NewRecorder()
	r.ServeHTTP(w4, req4)

	if w4.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing target, got %d", w4.Code)
	}

	// Test 5: Verify CreateConversationDto deserialization of 'name' and 'participantIds'
	jsonStr := `{"type": "group", "name": "iOS Squad", "participantIds": [11, 14]}`
	var dto chat.CreateConversationDto
	if err := json.Unmarshal([]byte(jsonStr), &dto); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	if dto.Name == nil || *dto.Name != "iOS Squad" {
		t.Errorf("expected dto.Name = 'iOS Squad', got %v", dto.Name)
	}
	if len(dto.ParticipantIds) != 2 || dto.ParticipantIds[0] != 11 || dto.ParticipantIds[1] != 14 {
		t.Errorf("expected dto.ParticipantIds = [11, 14], got %v", dto.ParticipantIds)
	}

	// Test 6: Verify CreateConversationResponseData response shape matches contract
	sampleResp := chat.CreateConversationResponseData{
		Conversation: chat.ConversationDto{
			ConversationID: "550e8400-e29b-41d4-a716-446655440000",
			Type:           "direct",
			CreatedBy:      12,
			MemberIDs:      []int64{12, 11},
		},
	}
	dataBytes, err := json.Marshal(sampleResp)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	var mapRes map[string]interface{}
	_ = json.Unmarshal(dataBytes, &mapRes)
	convMap, ok := mapRes["conversation"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'conversation' object in response, got %v", mapRes)
	}
	if convMap["conversationId"] != "550e8400-e29b-41d4-a716-446655440000" {
		t.Errorf("unexpected conversationId: %v", convMap["conversationId"])
	}
	if convMap["type"] != "direct" {
		t.Errorf("unexpected type: %v", convMap["type"])
	}

	// Test 7: Group conversation with name: { "name": "iOS Squad", "participantIds": [11, 14], "type": "group" }
	body7 := `{"name": "iOS Squad", "participantIds": [11, 14], "type": "group"}`
	req7 := httptest.NewRequest("POST", "/conversations", bytes.NewBufferString(body7))
	req7.Header.Set("Content-Type", "application/json")
	w7 := httptest.NewRecorder()
	r.ServeHTTP(w7, req7)

	if w7.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for group creation, got %d: %s", w7.Code, w7.Body.String())
	}
	var res7 map[string]interface{}
	_ = json.Unmarshal(w7.Body.Bytes(), &res7)
	conv7, _ := res7["data"].(map[string]interface{})["conversation"].(map[string]interface{})
	if conv7["title"] != "iOS Squad" {
		t.Errorf("expected title 'iOS Squad', got %v", conv7["title"])
	}
}
