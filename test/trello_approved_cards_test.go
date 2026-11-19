package test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/modules/chat"
	"datemate/internal/modules/users"
	"datemate/internal/platform/geo"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type mockBroadcaster struct {
	events []struct {
		Room  string
		Event string
		Data  interface{}
	}
}

func (m *mockBroadcaster) BroadcastToRoom(room string, event string, data interface{}) {
	m.events = append(m.events, struct {
		Room  string
		Event string
		Data  interface{}
	}{
		Room:  room,
		Event: event,
		Data:  data,
	})
}

// -----------------------------------------------------------------------
// Card #69: Backend: Block user
// -----------------------------------------------------------------------
func TestCard69_BlockUserDTOAndEndpoints(t *testing.T) {
	// 1. Verify BlockedUserDto JSON serialization
	now := time.Now().UTC()
	pic := "https://dev-datemate.testdevvvv.site/assets/images/pic.webp"
	dto := users.BlockedUserDto{
		ID:                101,
		Username:          "john_doe",
		FirstName:         "John",
		ProfilePictureUrl: &pic,
		AvatarUrl:         &pic,
		BlockedAt:         now,
	}

	b, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal BlockedUserDto: %v", err)
	}
	s := string(b)
	if !strings.Contains(s, `"id":101`) ||
		!strings.Contains(s, `"username":"john_doe"`) ||
		!strings.Contains(s, `"firstName":"John"`) ||
		!strings.Contains(s, `"profilePictureUrl":`) ||
		!strings.Contains(s, `"blockedAt":`) {
		t.Errorf("BlockedUserDto JSON missing required fields: %s", s)
	}

	// 2. Setup mock HTTP router for Users module
	cfg := &config.Config{AssetBaseURL: "http://localhost:3000"}
	storeEng, _ := storage.NewLocalEngine(t.TempDir())
	geoSvc := geo.NewService("")
	userSvc := users.NewService(cfg, nil, geoSvc, storeEng)
	broadcaster := &mockBroadcaster{}
	userSvc.SetBroadcaster(broadcaster)
	userHandler := users.NewHandler(userSvc, cfg, nil)

	r := chi.NewRouter()
	r.Use(middleware.TransformEnvelope())
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			authUser := &middleware.AuthUser{
				ID:        50,
				Email:     "user50@example.com",
				Role:      "USER",
				SessionID: 1,
			}
			ctx := context.WithValue(req.Context(), middleware.UserContextKey, authUser)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	userHandler.RegisterRoutes(r)

	// Test: Blocking self must return 400 Bad Request
	reqBlockSelf := httptest.NewRequest("POST", "/users/50/block", bytes.NewBufferString(`{"reason":"test"}`))
	reqBlockSelf.Header.Set("Content-Type", "application/json")
	wBlockSelf := httptest.NewRecorder()
	r.ServeHTTP(wBlockSelf, reqBlockSelf)
	if wBlockSelf.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for blocking self, got %d: %s", wBlockSelf.Code, wBlockSelf.Body.String())
	}

	// Test: Unblocking self must return 400 Bad Request
	reqUnblockSelf := httptest.NewRequest("DELETE", "/users/50/block", nil)
	wUnblockSelf := httptest.NewRecorder()
	r.ServeHTTP(wUnblockSelf, reqUnblockSelf)
	if wUnblockSelf.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for unblocking self, got %d: %s", wUnblockSelf.Code, wUnblockSelf.Body.String())
	}

	// Test: GET /users/blocked returns 200 OK and list (empty in mock mode)
	reqGetBlocked := httptest.NewRequest("GET", "/users/blocked", nil)
	wGetBlocked := httptest.NewRecorder()
	r.ServeHTTP(wGetBlocked, reqGetBlocked)
	if wGetBlocked.Code != http.StatusOK {
		t.Errorf("expected 200 for GET /users/blocked, got %d: %s", wGetBlocked.Code, wGetBlocked.Body.String())
	}
}

// -----------------------------------------------------------------------
// Card #78: Chat: server-side unread state for conversations
// -----------------------------------------------------------------------
func TestCard78_UnreadStatePerConversation(t *testing.T) {
	// 1. Verify ConversationDto contains unreadCount
	conv := chat.ConversationDto{
		ConversationID: uuid.NewString(),
		Type:           "direct",
		UnreadCount:    5,
	}
	b, err := json.Marshal(conv)
	if err != nil {
		t.Fatalf("failed to marshal ConversationDto: %v", err)
	}
	if !strings.Contains(string(b), `"unreadCount":5`) {
		t.Errorf("expected unreadCount in ConversationDto, got: %s", string(b))
	}

	// 2. Setup mock HTTP router for Chat module
	cfg := &config.Config{AssetBaseURL: "http://localhost:3000"}
	storeEng, _ := storage.NewLocalEngine(t.TempDir())
	chatSvc := chat.NewService(cfg, nil, nil, nil, storeEng)
	broadcaster := &mockBroadcaster{}
	chatSvc.SetBroadcaster(broadcaster)
	chatHandler := chat.NewHandler(chatSvc, cfg, nil)

	r := chi.NewRouter()
	r.Use(middleware.TransformEnvelope())
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			authUser := &middleware.AuthUser{
				ID:        15,
				Email:     "user15@example.com",
				Role:      "USER",
				SessionID: 1,
			}
			ctx := context.WithValue(req.Context(), middleware.UserContextKey, authUser)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	chatHandler.RegisterRoutes(r)

	// 3. Mark conversation read via POST /conversations/{id}/read
	convID := uuid.NewString()
	readPayload := fmt.Sprintf(`{"messageId":"%s"}`, uuid.NewString())
	reqRead := httptest.NewRequest("POST", "/conversations/"+convID+"/read", bytes.NewBufferString(readPayload))
	reqRead.Header.Set("Content-Type", "application/json")
	wRead := httptest.NewRecorder()
	r.ServeHTTP(wRead, reqRead)

	if wRead.Code != http.StatusOK {
		t.Fatalf("expected 200 for POST /conversations/{id}/read, got %d: %s", wRead.Code, wRead.Body.String())
	}
	var res map[string]interface{}
	_ = json.Unmarshal(wRead.Body.Bytes(), &res)
	if res["success"] != true {
		t.Errorf("expected success: true, got %v", res["success"])
	}
	data, _ := res["data"].(map[string]interface{})
	if data["conversationId"] != convID {
		t.Errorf("expected conversationId %s, got %v", convID, data["conversationId"])
	}
	if fmt.Sprintf("%v", data["unreadCount"]) != "0" {
		t.Errorf("expected unreadCount 0, got %v", data["unreadCount"])
	}
}

// -----------------------------------------------------------------------
// Card #68: Chat: message deletion
// -----------------------------------------------------------------------
func TestCard68_MessageDeletion(t *testing.T) {
	cfg := &config.Config{AssetBaseURL: "http://localhost:3000"}
	storeEng, _ := storage.NewLocalEngine(t.TempDir())
	chatSvc := chat.NewService(cfg, nil, nil, nil, storeEng)
	broadcaster := &mockBroadcaster{}
	chatSvc.SetBroadcaster(broadcaster)
	chatHandler := chat.NewHandler(chatSvc, cfg, nil)

	r := chi.NewRouter()
	r.Use(middleware.TransformEnvelope())
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			authUser := &middleware.AuthUser{
				ID:        20,
				Email:     "user20@example.com",
				Role:      "USER",
				SessionID: 1,
			}
			ctx := context.WithValue(req.Context(), middleware.UserContextKey, authUser)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	chatHandler.RegisterRoutes(r)

	convID := uuid.NewString()
	msgID := uuid.NewString()

	// 1. Delete message for me: DELETE /conversations/{id}/messages/{id}?forEveryone=false
	reqDeleteMe := httptest.NewRequest("DELETE", "/conversations/"+convID+"/messages/"+msgID+"?forEveryone=false", nil)
	wDeleteMe := httptest.NewRecorder()
	r.ServeHTTP(wDeleteMe, reqDeleteMe)

	if wDeleteMe.Code != http.StatusOK {
		t.Fatalf("expected 200 for delete for me, got %d: %s", wDeleteMe.Code, wDeleteMe.Body.String())
	}
	var resMe map[string]interface{}
	_ = json.Unmarshal(wDeleteMe.Body.Bytes(), &resMe)
	dataMe, _ := resMe["data"].(map[string]interface{})
	if dataMe["forEveryone"] != false {
		t.Errorf("expected forEveryone: false, got %v", dataMe["forEveryone"])
	}

	// 2. Delete message for everyone via JSON body: DELETE /conversations/{id}/messages/{id}
	reqDeleteEveryone := httptest.NewRequest("DELETE", "/conversations/"+convID+"/messages/"+msgID, bytes.NewBufferString(`{"forEveryone":true}`))
	reqDeleteEveryone.Header.Set("Content-Type", "application/json")
	wDeleteEveryone := httptest.NewRecorder()
	r.ServeHTTP(wDeleteEveryone, reqDeleteEveryone)

	if wDeleteEveryone.Code != http.StatusOK {
		t.Fatalf("expected 200 for delete for everyone, got %d: %s", wDeleteEveryone.Code, wDeleteEveryone.Body.String())
	}
	var resEveryone map[string]interface{}
	_ = json.Unmarshal(wDeleteEveryone.Body.Bytes(), &resEveryone)
	dataEveryone, _ := resEveryone["data"].(map[string]interface{})
	if dataEveryone["forEveryone"] != true {
		t.Errorf("expected forEveryone: true, got %v", dataEveryone["forEveryone"])
	}
}
