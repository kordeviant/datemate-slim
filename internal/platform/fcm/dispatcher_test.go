package fcm

import (
	"context"
	"encoding/base64"
	"os"
	"strings"
	"testing"
	"time"

	"firebase.google.com/go/v4/messaging"
)

func TestFCMDispatcher_MockMode(t *testing.T) {
	d := NewDispatcher(nil, true, 2, 10)
	defer d.Close()

	if !d.mockMode {
		t.Errorf("expected mockMode to be true")
	}

	jobID := d.Enqueue(NotificationJob{
		Title: "Mock Test",
		Body:  "Hello from mock dispatcher",
		Topic: "test_topic",
	})

	if jobID == "" {
		t.Errorf("expected non-empty jobID")
	}

	// Wait briefly for worker to consume
	time.Sleep(50 * time.Millisecond)
}

func TestFCMDispatcher_RealFirebaseConnection(t *testing.T) {
	candidates := []string{
		"firebase-service-account.json",
		"../../firebase-service-account.json",
		"/home/parsa/Documents/projects/datemate/backend/firebase-service-account.json",
	}
	var credPath string
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			credPath = c
			break
		}
	}

	if credPath == "" {
		t.Skip("firebase-service-account.json not found, skipping real Firebase live test")
	}

	d := NewDispatcher(nil, false, 2, 10, credPath, "")
	defer d.Close()

	if d.mockMode || d.client == nil {
		t.Fatalf("expected real Firebase client to be initialized, got mockMode=%v", d.mockMode)
	}

	// Dispatch real topic message to Google FCM
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	msg := &messaging.Message{
		Topic: "test_backend_health",
		Notification: &messaging.Notification{
			Title: "Backend Test",
			Body:  "Testing real FCM connection from DateMate backend",
		},
	}

	msgID, err := d.client.Send(ctx, msg)
	if err != nil {
		t.Fatalf("Failed to dispatch test notification to Google FCM: %v", err)
	}

	if !strings.HasPrefix(msgID, "projects/datemate-3d549/messages/") {
		t.Errorf("unexpected message ID format: %s", msgID)
	}
	t.Logf("Successfully dispatched to Google Firebase Cloud Messaging! Message ID: %s", msgID)
}

func TestFCMDispatcher_CredentialsFromEnv(t *testing.T) {
	data, err := os.ReadFile("firebase-service-account.json")
	if err != nil {
		t.Skip("firebase-service-account.json not found for env test")
	}

	// Test 1: Raw JSON string via FIREBASE_SERVICE_ACCOUNT env var
	t.Setenv("FIREBASE_SERVICE_ACCOUNT", string(data))
	t.Setenv("FIREBASE_CREDENTIALS_PATH", "non-existent-path.json")

	d1 := NewDispatcher(nil, false, 1, 10)
	defer d1.Close()

	if d1.mockMode || d1.client == nil {
		t.Errorf("expected real Firebase client initialized via FIREBASE_SERVICE_ACCOUNT env var")
	}

	// Test 2: Base64 encoded JSON string via FIREBASE_SERVICE_ACCOUNT_DEV env var
	b64 := base64.StdEncoding.EncodeToString(data)
	t.Setenv("FIREBASE_SERVICE_ACCOUNT", "")
	t.Setenv("FIREBASE_SERVICE_ACCOUNT_DEV", b64)

	d2 := NewDispatcher(nil, false, 1, 10)
	defer d2.Close()

	if d2.mockMode || d2.client == nil {
		t.Errorf("expected real Firebase client initialized via base64 FIREBASE_SERVICE_ACCOUNT_DEV env var")
	}
}
