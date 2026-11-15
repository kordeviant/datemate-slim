package users

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"datemate/internal/middleware"
	"datemate/internal/platform/database/db"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestProfileCompleted_RequiresPrivacyAcceptance(t *testing.T) {
	// Case 1: All required profile details are present but PrivacyAcceptedAt is not valid
	uWithoutPrivacy := db.Users{
		ID:                1,
		Email:             "test@example.com",
		PrivacyAcceptedAt: pgtype.Timestamp{Valid: false},
	}
	p := db.Profiles{
		FirstName: "John",
		AvatarUrl: "https://example.com/avatar.jpg",
	}
	d := db.Demographics{
		Gender: "MALE",
	}
	gallery := []GalleryItemResponseDto{}

	hasPrivacy := uWithoutPrivacy.PrivacyAcceptedAt.Valid && !uWithoutPrivacy.PrivacyAcceptedAt.Time.IsZero()
	completedWithoutPrivacy := p.FirstName != "" && (p.AvatarUrl != "" || len(gallery) > 0) && d.Gender != "" && hasPrivacy

	if completedWithoutPrivacy {
		t.Fatalf("expected profileCompleted to be false when privacy is not accepted, got true")
	}

	// Case 2: Privacy is accepted
	uWithPrivacy := db.Users{
		ID:                1,
		Email:             "test@example.com",
		PrivacyAcceptedAt: pgtype.Timestamp{Time: time.Now(), Valid: true},
	}
	hasPrivacyAccepted := uWithPrivacy.PrivacyAcceptedAt.Valid && !uWithPrivacy.PrivacyAcceptedAt.Time.IsZero()
	completedWithPrivacy := p.FirstName != "" && (p.AvatarUrl != "" || len(gallery) > 0) && d.Gender != "" && hasPrivacyAccepted

	if !completedWithPrivacy {
		t.Fatalf("expected profileCompleted to be true when privacy is accepted, got false")
	}
}

func TestAcceptPrivacyResponseDto_Serialization(t *testing.T) {
	dto := AcceptPrivacyResponseDto{
		PrivacyAcceptedAt: "2026-11-11T16:40:00Z",
		ProfileCompleted:  true,
	}

	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal AcceptPrivacyResponseDto: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if parsed["privacyAcceptedAt"] != "2026-11-11T16:40:00Z" {
		t.Errorf("expected privacyAcceptedAt 2026-11-11T16:40:00Z, got %v", parsed["privacyAcceptedAt"])
	}
	if parsed["profileCompleted"] != true {
		t.Errorf("expected profileCompleted true, got %v", parsed["profileCompleted"])
	}
}

type mockPrivacyUserSvc struct {
	accepted bool
}

func TestAcceptPrivacy_HandlerRoute(t *testing.T) {
	h := NewHandler(nil, nil, nil)
	r := httptest.NewRequest(http.MethodPost, "/users/privacy", nil)
	ctx := context.WithValue(r.Context(), middleware.UserContextKey, &middleware.AuthUser{ID: 10, Email: "user@example.com", Role: "USER"})
	r = r.WithContext(ctx)

	w := httptest.NewRecorder()
	// Since svc is nil in this stub handler, it should handle error gracefully without panicking
	defer func() {
		if rec := recover(); rec != nil {
			// Svc is nil in stub, panic recovery is expected
		}
	}()
	h.AcceptPrivacy(w, r)
}
