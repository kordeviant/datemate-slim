package notifications

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"datemate/internal/config"
	"datemate/internal/platform/fcm"
)

func TestSendPush_RecipientValidation(t *testing.T) {
	cfg := &config.Config{
		InternalAPIKey: "test-internal-key",
	}
	dispatcher := fcm.NewDispatcher(nil, true, 1, 10)
	handler := NewHandler(cfg, dispatcher)

	// 1. Missing recipient: should return 400 Bad Request
	bodyNoTarget, _ := json.Marshal(map[string]interface{}{
		"title": "Hello",
		"body":  "Test body without target recipient",
	})
	req1 := httptest.NewRequest("POST", "/push", bytes.NewReader(bodyNoTarget))
	req1.Header.Set("x-api-key", "test-internal-key")
	w1 := httptest.NewRecorder()

	handler.SendPush(w1, req1)
	if w1.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for missing recipient, got %d", w1.Code)
	}

	// 2. Missing title/body: should return 400 Bad Request
	bodyNoTitle, _ := json.Marshal(map[string]interface{}{
		"device_token": "fcm_token_123",
	})
	req2 := httptest.NewRequest("POST", "/push", bytes.NewReader(bodyNoTitle))
	w2 := httptest.NewRecorder()

	handler.SendPush(w2, req2)
	if w2.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for missing title/body, got %d", w2.Code)
	}

	// 3. Valid target with device_token: should return 202 Accepted
	bodyValidToken, _ := json.Marshal(map[string]interface{}{
		"title":        "Hello",
		"body":         "Test notification",
		"device_token": "fcm_token_123",
	})
	req3 := httptest.NewRequest("POST", "/push", bytes.NewReader(bodyValidToken))
	w3 := httptest.NewRecorder()

	handler.SendPush(w3, req3)
	if w3.Code != http.StatusAccepted {
		t.Errorf("expected status 202 for valid device_token, got %d", w3.Code)
	}

	var res3 PushResponseDto
	if err := json.NewDecoder(w3.Body).Decode(&res3); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res3.Status != "QUEUED" {
		t.Errorf("expected status QUEUED, got %s", res3.Status)
	}
	if res3.JobID == "" {
		t.Errorf("expected non-empty job_id")
	}

	// 4. Valid target with userId: should return 202 Accepted
	bodyValidUser, _ := json.Marshal(map[string]interface{}{
		"title":  "Hello",
		"body":   "Test notification",
		"userId": 42,
	})
	req4 := httptest.NewRequest("POST", "/push", bytes.NewReader(bodyValidUser))
	w4 := httptest.NewRecorder()

	handler.SendPush(w4, req4)
	if w4.Code != http.StatusAccepted {
		t.Errorf("expected status 202 for valid userId, got %d", w4.Code)
	}

	// 5. Valid target with topic: should return 202 Accepted
	bodyValidTopic, _ := json.Marshal(map[string]interface{}{
		"title": "Broadcast",
		"body":  "Test broadcast",
		"topic": "announcements",
	})
	req5 := httptest.NewRequest("POST", "/push", bytes.NewReader(bodyValidTopic))
	w5 := httptest.NewRecorder()

	handler.SendPush(w5, req5)
	if w5.Code != http.StatusAccepted {
		t.Errorf("expected status 202 for valid topic, got %d", w5.Code)
	}
}

