package chat

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/middleware"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
)

func TestCreateConversation_DirectWithParticipantIds(t *testing.T) {
	// Verify that a legacy client payload containing participantIds: [42] is decoded and accepted
	cfg := &config.Config{}
	svc := &Service{}
	handler := &Handler{
		svc: svc,
		cfg: cfg,
	}

	payload := map[string]interface{}{
		"type":           "direct",
		"participantIds": []int64{42},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/conversations", bytes.NewReader(body))
	// Authenticated as user 1
	ctx := context.WithValue(req.Context(), middleware.UserContextKey, &middleware.AuthUser{
		ID:        1,
		Email:     "user1@example.com",
		Role:      "USER",
		SessionID: 10,
	})
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	// In this test, svc is nil-backed for DB, so CreateDirectConversation would fail with nil pointer or DB error,
	// but it must NOT fail at handler level with 400 "targetUserId is required for direct conversation"!
	defer func() {
		_ = recover()
	}()

	handler.CreateConversation(w, req)
	if w.Code == http.StatusBadRequest {
		var errRes map[string]interface{}
		_ = json.Unmarshal(w.Body.Bytes(), &errRes)
		if msg, ok := errRes["message"].(string); ok && msg == "targetUserId is required for direct conversation" {
			t.Errorf("handler rejected legacy participantIds payload with: %s", msg)
		}
	}
}

func TestCursorPagination_MultiDayBucketTraversal(t *testing.T) {
	// 1. Verify cursor encoding and decoding with bucket and offset
	original := common.PageCursorData{
		Bucket: "20261108",
		Offset: 30,
		T:      time.Now().UnixMilli(),
	}

	encoded, err := common.EncodeCursor(original)
	if err != nil {
		t.Fatalf("failed to encode cursor: %v", err)
	}

	decoded, err := common.DecodeCursor(encoded)
	if err != nil {
		t.Fatalf("failed to decode cursor: %v", err)
	}

	if decoded.Bucket != original.Bucket {
		t.Errorf("expected bucket %s, got %s", original.Bucket, decoded.Bucket)
	}
	if decoded.Offset != original.Offset {
		t.Errorf("expected offset %d, got %d", original.Offset, decoded.Offset)
	}

	// 2. Test previous bucket calculation
	prev := common.GetPreviousBucket("20261108")
	if prev != "20261107" {
		t.Errorf("expected previous bucket 20261107, got %s", prev)
	}

	prevMonth := common.GetPreviousBucket("20260301")
	if prevMonth != "20260228" {
		t.Errorf("expected previous bucket 20260228, got %s", prevMonth)
	}
}

func TestUpload_LocalEngine(t *testing.T) {
	tmpDir := t.TempDir()
	eng, err := storage.NewLocalEngine(tmpDir)
	if err != nil {
		t.Fatalf("failed to create local engine: %v", err)
	}

	cfg := &config.Config{
		AssetBaseURL: "http://localhost:3000",
		UploadsDir:   tmpDir,
	}
	svc := &Service{
		cfg:     cfg,
		storage: eng,
	}
	handler := &Handler{
		svc:          svc,
		cfg:          cfg,
		assetHandler: storage.NewAssetHandler(eng, false),
	}

	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	part, err := w.CreateFormFile("file", "voice_note.ogg")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte("OggS simulated audio payload"))
	w.WriteField("type", "voice")
	w.WriteField("duration", "4.2")
	w.Close()

	req := httptest.NewRequest("POST", "/v1/chat/upload", &b)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rec := httptest.NewRecorder()

	handler.Upload(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Data UploadMediaResponseData `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res.Data.Type != "voice" {
		t.Errorf("expected type 'voice', got %s", res.Data.Type)
	}
	if res.Data.Duration == nil || *res.Data.Duration != 4.2 {
		t.Errorf("expected duration 4.2, got %v", res.Data.Duration)
	}
	if res.Data.StoredFileName == "" {
		t.Errorf("expected storedFileName to be populated")
	}

	// 2. Verify ServeUpload can retrieve the uploaded file
	serveReq := httptest.NewRequest("GET", "/uploads/"+res.Data.StoredFileName, nil)
	// Add chi URL param
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("fileName", res.Data.StoredFileName)
	serveReq = serveReq.WithContext(context.WithValue(serveReq.Context(), chi.RouteCtxKey, rctx))
	serveRec := httptest.NewRecorder()

	handler.ServeUpload(serveRec, serveReq)
	if serveRec.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK for ServeUpload, got %d", serveRec.Code)
	}
	if !bytes.Contains(serveRec.Body.Bytes(), []byte("OggS simulated audio payload")) {
		t.Errorf("served content mismatch: got %s", serveRec.Body.String())
	}
}

func TestUpload_BlobRecordingAutoExtension(t *testing.T) {
	tmpDir := t.TempDir()
	eng, err := storage.NewLocalEngine(tmpDir)
	if err != nil {
		t.Fatalf("failed to create local engine: %v", err)
	}

	cfg := &config.Config{
		AssetBaseURL: "https://chat-datemate.testdevvvv.site",
		UploadsDir:   tmpDir,
	}
	svc := &Service{
		cfg:     cfg,
		storage: eng,
	}
	handler := &Handler{
		svc:          svc,
		cfg:          cfg,
		assetHandler: storage.NewAssetHandler(eng, false),
	}

	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	// Field named "audio" with filename "blob" (typical mobile recording)
	part, err := w.CreateFormFile("audio", "blob")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write([]byte("simulated audio bytes"))
	w.WriteField("type", "audio")
	w.WriteField("duration", "15.0")
	w.Close()

	req := httptest.NewRequest("POST", "/v1/chat/upload", &b)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rec := httptest.NewRecorder()

	handler.Upload(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Data UploadMediaResponseData `json:"data"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if res.Data.Type != "voice" {
		t.Errorf("expected normalized type 'voice', got %q", res.Data.Type)
	}
	if res.Data.Url == "" || !bytes.Contains([]byte(res.Data.Url), []byte("/uploads/")) {
		t.Errorf("unexpected URL structure: %s", res.Data.Url)
	}
}

func TestNormalizeMessageType(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"VOICE", "voice"},
		{"audio", "voice"},
		{"IMAGE", "image"},
		{"photo", "image"},
		{"VIDEO", "video"},
		{"file", "file"},
		{"document", "file"},
		{"TEXT", "text"},
		{"", "text"},
	}

	for _, tt := range tests {
		got := normalizeMessageType(tt.input)
		if got != tt.expected {
			t.Errorf("normalizeMessageType(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

