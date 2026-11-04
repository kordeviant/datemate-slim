package auth

import (
	"net/http"
	"net/http/httptest"
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
