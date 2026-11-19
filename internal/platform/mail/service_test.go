package mail

import (
	"context"
	"strings"
	"testing"
)

func TestFormatVerificationEmail(t *testing.T) {
	code := "849201"
	html := FormatVerificationEmail(code)

	if !strings.Contains(html, code) {
		t.Errorf("expected HTML to contain verification code %s", code)
	}
	if !strings.Contains(html, "DateMate") {
		t.Errorf("expected HTML to contain brand DateMate")
	}
	if !strings.Contains(html, "10 minutes") {
		t.Errorf("expected HTML to mention 10 minutes expiry")
	}
}

func TestFormatPasswordResetEmail(t *testing.T) {
	code := "192837"
	html := FormatPasswordResetEmail(code)

	if !strings.Contains(html, code) {
		t.Errorf("expected HTML to contain reset code %s", code)
	}
	if !strings.Contains(html, "Reset Your Password") {
		t.Errorf("expected HTML to mention Reset Your Password")
	}
}

func TestMailerSimulationFallback(t *testing.T) {
	// With empty host, mailer operates in mock simulation mode without error
	svc := NewService("", 587, "", "", "noreply@datemate.app", false)
	err := svc.SendEmail(context.Background(), "user@example.com", "Test Subject", "Test Body")
	if err != nil {
		t.Fatalf("expected nil error for simulation mode, got: %v", err)
	}

	// Missing recipient returns error
	errMissingTo := svc.SendEmail(context.Background(), "", "Test Subject", "Test Body")
	if errMissingTo == nil {
		t.Errorf("expected error when recipient email is empty")
	}
}
