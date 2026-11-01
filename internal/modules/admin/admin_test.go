package admin

import (
	"encoding/json"
	"testing"
	"time"
)

func TestAdminUserItemDto_Serialization(t *testing.T) {
	fn := "John"
	un := "johndoe"
	av := "https://cdn.example.com/avatar.jpg"
	city := "Tehran"
	age := 30
	gen := "MALE"
	bd := "1996-01-01"
	bannedAt := time.Now().Add(24 * time.Hour)

	dto := AdminUserItemDto{
		ID:               1,
		Email:            "john@example.com",
		FullName:         fn,
		FirstName:        &fn,
		Username:         &un,
		AvatarUrl:        &av,
		City:             &city,
		Age:              &age,
		Gender:           &gen,
		BirthDate:        &bd,
		ProfileValidated: true,
		HasPendingSelfie: false,
		IsOnline:         true,
		IsPremium:        true,
		IsBanned:         true,
		BannedUntil:      &bannedAt,
		CreatedAt:        time.Now().UTC(),
	}

	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal AdminUserItemDto: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if raw["fullName"] != fn {
		t.Errorf("expected fullName %s, got %v", fn, raw["fullName"])
	}
	if raw["age"] != float64(age) {
		t.Errorf("expected age %d, got %v", age, raw["age"])
	}
	if raw["city"] != city {
		t.Errorf("expected city %s, got %v", city, raw["city"])
	}
	if raw["isOnline"] != true {
		t.Errorf("expected isOnline true, got %v", raw["isOnline"])
	}
	if raw["hasPendingSelfie"] != false {
		t.Errorf("expected hasPendingSelfie false, got %v", raw["hasPendingSelfie"])
	}
}
