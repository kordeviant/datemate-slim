package test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/modules/chat"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// -----------------------------------------------------------------------
// Card #106: Backend: reply to a message in chat
// -----------------------------------------------------------------------
func TestCard106_ReplyToMessageDTOAndSerialization(t *testing.T) {
	msgID := uuid.NewString()
	content := "Original quoted message text"
	mediaUrl := "https://dev-datemate.testdevvvv.site/uploads/voice.m4a"

	replyDto := chat.ReplyToDto{
		MessageID: msgID,
		SenderID:  101,
		Type:      "voice",
		Content:   &content,
		Url:       &mediaUrl,
		IsDeleted: false,
	}

	b, err := json.Marshal(replyDto)
	if err != nil {
		t.Fatalf("Failed to marshal ReplyToDto: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(b, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	if parsed["messageId"] != msgID {
		t.Errorf("Expected messageId %s, got %v", msgID, parsed["messageId"])
	}
	if parsed["type"] != "voice" {
		t.Errorf("Expected type voice, got %v", parsed["type"])
	}
	if parsed["content"] != content {
		t.Errorf("Expected content %s, got %v", content, parsed["content"])
	}
	if parsed["url"] != mediaUrl {
		t.Errorf("Expected url %s, got %v", mediaUrl, parsed["url"])
	}
	if parsed["isDeleted"] != false {
		t.Errorf("Expected isDeleted false, got %v", parsed["isDeleted"])
	}

	// Deleted message reply
	deletedReply := chat.ReplyToDto{
		MessageID: msgID,
		SenderID:  101,
		Type:      "text",
		Content:   nil,
		Url:       nil,
		IsDeleted: true,
	}
	bDel, err := json.Marshal(deletedReply)
	if err != nil {
		t.Fatalf("Failed to marshal deleted ReplyToDto: %v", err)
	}
	var parsedDel map[string]interface{}
	if err := json.Unmarshal(bDel, &parsedDel); err != nil {
		t.Fatalf("Failed to unmarshal deleted JSON: %v", err)
	}
	if parsedDel["isDeleted"] != true {
		t.Errorf("Expected isDeleted true, got %v", parsedDel["isDeleted"])
	}
	if parsedDel["content"] != nil {
		t.Errorf("Expected content nil, got %v", parsedDel["content"])
	}
}

func TestCard106_MessageItemDtoContainsReplyTo(t *testing.T) {
	msgID := uuid.NewString()
	replyID := uuid.NewString()
	text := "Quoted snippet"

	msg := chat.MessageItemDto{
		MessageID:      msgID,
		ConversationID: uuid.NewString(),
		SenderID:       15,
		Content:        "This is a reply message",
		CreatedAt:      time.Now().UTC().Format(time.RFC3339Nano),
		Type:           "text",
		ReplyTo: &chat.ReplyToDto{
			MessageID: replyID,
			SenderID:  202,
			Type:      "text",
			Content:   &text,
			Url:       nil,
			IsDeleted: false,
		},
	}

	b, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal MessageItemDto: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(b, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	replyRaw, exists := parsed["replyTo"]
	if !exists || replyRaw == nil {
		t.Fatalf("Expected replyTo object in MessageItemDto JSON, got none")
	}
	replyMap := replyRaw.(map[string]interface{})
	if replyMap["messageId"] != replyID {
		t.Errorf("Expected quoted messageId %s, got %v", replyID, replyMap["messageId"])
	}
	if replyMap["senderId"].(float64) != 202 {
		t.Errorf("Expected senderId 202, got %v", replyMap["senderId"])
	}
}

// -----------------------------------------------------------------------
// Card x1M0SVtS: Chat list: typing indicator states
// -----------------------------------------------------------------------
func TestCardTyping_DTOAndEndpoints(t *testing.T) {
	cfg := &config.Config{
		AssetBaseURL: "https://dev-datemate.testdevvvv.site",
	}
	localStorage, _ := storage.NewLocalEngine(t.TempDir())
	chatSvc := chat.NewService(cfg, nil, nil, nil, localStorage)

	handler := chat.NewHandler(chatSvc, cfg, nil)
	r := chi.NewRouter()

	// Mock authenticated user context middleware (user 15)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), middleware.UserContextKey, &middleware.AuthUser{
				ID:    15,
				Email: "test@datemate.app",
				Role:  "USER",
			})
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	handler.RegisterRoutes(r)

	convID := uuid.NewString()

	// 1. GET /conversations/{conversationId}/typing returns empty list when no typers
	req := httptest.NewRequest("GET", "/conversations/"+convID+"/typing", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected GET /typing to return 200, got %d. Body: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Success bool                       `json:"success"`
		Data    chat.ActiveTypingResponseDto `json:"data"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}
	if !resp.Success {
		t.Errorf("Expected success true, got false")
	}
	if resp.Data.ConversationID != convID {
		t.Errorf("Expected conversationId %s, got %s", convID, resp.Data.ConversationID)
	}
	if resp.Data.TypingUsers == nil {
		t.Errorf("Expected typingUsers to be non-nil array")
	}

	// 2. Verify TypingPayload serialization for all supported states
	actions := []string{"typing", "recording_voice", "uploading_media"}
	for _, action := range actions {
		payload := chat.TypingPayload{
			ConversationID: convID,
			Action:         action,
		}
		b, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("Failed to marshal TypingPayload for action %s: %v", action, err)
		}
		var parsed map[string]interface{}
		_ = json.Unmarshal(b, &parsed)
		if parsed["action"] != action {
			t.Errorf("Expected action %s, got %v", action, parsed["action"])
		}
	}
}
