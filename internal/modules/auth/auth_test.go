package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestExtractRawSocialToken(t *testing.T) {
	// 1. From Authorization Bearer header
	t1 := extractRawSocialToken("Bearer eyJhbGciOi...", SocialAuthRequest{})
	if t1 != "eyJhbGciOi..." {
		t.Errorf("expected eyJhbGciOi..., got %s", t1)
	}

	// 2. From raw Authorization header
	t2 := extractRawSocialToken("eyJhbGciOi...", SocialAuthRequest{})
	if t2 != "eyJhbGciOi..." {
		t.Errorf("expected eyJhbGciOi..., got %s", t2)
	}

	// 3. From req.IdentityToken
	t3 := extractRawSocialToken("", SocialAuthRequest{IdentityToken: "identity_token_123"})
	if t3 != "identity_token_123" {
		t.Errorf("expected identity_token_123, got %s", t3)
	}

	// 4. From req.IdToken
	t4 := extractRawSocialToken("", SocialAuthRequest{IdToken: "id_token_456"})
	if t4 != "id_token_456" {
		t.Errorf("expected id_token_456, got %s", t4)
	}

	// 5. From req.Token
	t5 := extractRawSocialToken("", SocialAuthRequest{Token: "token_789"})
	if t5 != "token_789" {
		t.Errorf("expected token_789, got %s", t5)
	}
}

func TestCleanSocialSub(t *testing.T) {
	sub := "001234.abcdef1234567890.1234"
	cleaned := cleanSocialSub(sub)
	expected := "001234_abcdef1234567890_1234"
	if cleaned != expected {
		t.Errorf("expected %s, got %s", expected, cleaned)
	}
}

func TestParseSocialTokenClaims(t *testing.T) {
	// Create a dummy unsigned/signed JWT with email and sub
	claims := jwt.MapClaims{
		"sub":            "apple.user.sub.98765",
		"email":          "real_user@icloud.com",
		"email_verified": "true",
		"iss":            "https://appleid.apple.com",
		"exp":            time.Now().Add(1 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("any_dummy_signing_key"))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}

	parsed, err := parseSocialTokenClaims(tokenString)
	if err != nil {
		t.Fatalf("expected parseSocialTokenClaims to succeed, got %v", err)
	}
	if parsed.Email != "real_user@icloud.com" {
		t.Errorf("expected email real_user@icloud.com, got %s", parsed.Email)
	}
	if parsed.Sub != "apple.user.sub.98765" {
		t.Errorf("expected sub apple.user.sub.98765, got %s", parsed.Sub)
	}
}

func TestParseSocialTokenClaimsWithoutEmail(t *testing.T) {
	// Apple user who chose "Hide My Email" - sub only
	claims := jwt.MapClaims{
		"sub": "000123.hide_my_email.sub",
		"iss": "https://appleid.apple.com",
		"exp": time.Now().Add(1 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte("any_dummy_signing_key"))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}

	parsed, err := parseSocialTokenClaims(tokenString)
	if err != nil {
		t.Fatalf("expected parseSocialTokenClaims to succeed, got %v", err)
	}
	if parsed.Email != "" {
		t.Errorf("expected empty email, got %s", parsed.Email)
	}
	if parsed.Sub != "000123.hide_my_email.sub" {
		t.Errorf("expected sub 000123.hide_my_email.sub, got %s", parsed.Sub)
	}
}

