package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func generateTestJWT(claims jwt.MapClaims) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte("secret"))
	return tokenString
}

func TestExtractSocialCredentials_FromJWTHeader(t *testing.T) {
	token := generateTestJWT(jwt.MapClaims{
		"email": "realuser@gmail.com",
		"name":  "Real User",
		"exp":   time.Now().Add(time.Hour).Unix(),
	})

	req := httptest.NewRequest(http.MethodPost, "/auth/google", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	email, fullName, err := extractSocialCredentials(req, SocialAuthRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if email != "realuser@gmail.com" {
		t.Errorf("expected email 'realuser@gmail.com', got '%s'", email)
	}
	if fullName != "Real User" {
		t.Errorf("expected fullName 'Real User', got '%s'", fullName)
	}
}

func TestExtractSocialCredentials_FromIdentityTokenBody(t *testing.T) {
	token := generateTestJWT(jwt.MapClaims{
		"email":       "appleuser@icloud.com",
		"given_name":  "Steve",
		"family_name": "Jobs",
	})

	req := httptest.NewRequest(http.MethodPost, "/auth/apple", nil)

	email, fullName, err := extractSocialCredentials(req, SocialAuthRequest{
		IdentityToken: token,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if email != "appleuser@icloud.com" {
		t.Errorf("expected email 'appleuser@icloud.com', got '%s'", email)
	}
	if fullName != "Steve Jobs" {
		t.Errorf("expected fullName 'Steve Jobs', got '%s'", fullName)
	}
}

func TestExtractSocialCredentials_DirectBodyEmail(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/auth/google", nil)

	email, fullName, err := extractSocialCredentials(req, SocialAuthRequest{
		Email:    "direct@example.com",
		FullName: "Direct User",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if email != "direct@example.com" {
		t.Errorf("expected email 'direct@example.com', got '%s'", email)
	}
	if fullName != "Direct User" {
		t.Errorf("expected fullName 'Direct User', got '%s'", fullName)
	}
}

func TestExtractSocialCredentials_MissingEmailFails(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/auth/google", nil)

	_, _, err := extractSocialCredentials(req, SocialAuthRequest{})
	if err == nil {
		t.Fatalf("expected error when email is missing, got nil")
	}
}

func TestResetPasswordRequest_AcceptsPasswordAndNewPassword(t *testing.T) {
	// Test 1: iOS sends "password"
	jsonBody1 := `{"email":"user@example.com","code":"123456","password":"SecretPassword123!"}`
	req1 := httptest.NewRequest(http.MethodPost, "/v1/auth/reset-password", strings.NewReader(jsonBody1))
	var r1 ResetPasswordRequest
	if err := json.NewDecoder(req1.Body).Decode(&r1); err != nil {
		t.Fatalf("failed to decode req1: %v", err)
	}
	pass1 := r1.Password
	if pass1 == "" {
		pass1 = r1.NewPassword
	}
	if pass1 != "SecretPassword123!" {
		t.Errorf("expected pass1 'SecretPassword123!', got '%s'", pass1)
	}

	// Test 2: Web / new client sends "newPassword"
	jsonBody2 := `{"email":"user@example.com","code":"123456","newPassword":"SecretPassword123!"}`
	req2 := httptest.NewRequest(http.MethodPost, "/v1/auth/reset-password", strings.NewReader(jsonBody2))
	var r2 ResetPasswordRequest
	if err := json.NewDecoder(req2.Body).Decode(&r2); err != nil {
		t.Fatalf("failed to decode req2: %v", err)
	}
	pass2 := r2.Password
	if pass2 == "" {
		pass2 = r2.NewPassword
	}
	if pass2 != "SecretPassword123!" {
		t.Errorf("expected pass2 'SecretPassword123!', got '%s'", pass2)
	}
}
