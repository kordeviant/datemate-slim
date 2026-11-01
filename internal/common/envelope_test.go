package common

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEnvelopeSuccess(t *testing.T) {
	w := httptest.NewRecorder()
	payload := map[string]string{"foo": "bar"}
	RespondSuccess(w, http.StatusOK, "Operation succeeded", payload)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}

	var res ResponseResult[map[string]string]
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to unmarshal envelope: %v", err)
	}

	if res.Status != "success" {
		t.Errorf("expected status 'success', got '%s'", res.Status)
	}
	if res.Message != "Operation succeeded" {
		t.Errorf("unexpected message '%s'", res.Message)
	}
	if res.Data["foo"] != "bar" {
		t.Errorf("unexpected data '%v'", res.Data)
	}
	if res.Error != nil {
		t.Errorf("expected nil error, got '%v'", res.Error)
	}
}

func TestEnvelopeError(t *testing.T) {
	w := httptest.NewRecorder()
	RespondError(w, http.StatusBadRequest, "Invalid parameter", ErrBadRequest)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}

	var res ResponseResult[any]
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to unmarshal envelope: %v", err)
	}

	if res.Status != "error" {
		t.Errorf("expected status 'error', got '%s'", res.Status)
	}
	if res.Data != nil {
		t.Errorf("expected nil data, got '%v'", res.Data)
	}
	if res.Error == nil {
		t.Fatal("expected error object, got nil")
	}
	if res.Error.Type != ErrBadRequest {
		t.Errorf("expected error type '%s', got '%s'", ErrBadRequest, res.Error.Type)
	}
}
