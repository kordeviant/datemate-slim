package fcm

import (
	"context"
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
