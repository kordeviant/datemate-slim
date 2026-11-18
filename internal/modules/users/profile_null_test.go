package users

import (
	"encoding/json"
	"testing"
)

func TestNewAccount_NullPlaceholderValues(t *testing.T) {
	// A new account that has not entered full name, birth date, or gender
	demographic := &DemographicResponseDto{
		BirthDate: nil,
		Gender:    nil,
		Height:    nil,
	}

	profile := ProfileNestedResponseDto{
		FullName:    nil,
		Demographic: demographic,
	}

	email := "newuser@gmail.com"
	res := &ProfileResponseDto{
		ID:      100,
		Email:   &email,
		Profile: profile,
	}

	data, err := json.Marshal(res)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if parsed["email"] != "newuser@gmail.com" {
		t.Errorf("expected email to be newuser@gmail.com, got %v", parsed["email"])
	}

	profMap, ok := parsed["Profile"].(map[string]interface{})
	if !ok {
		t.Fatalf("Profile must be an object")
	}

	if profMap["fullName"] != nil {
		t.Errorf("expected fullName to be null, got %v", profMap["fullName"])
	}

	demMap, ok := profMap["Demographic"].(map[string]interface{})
	if !ok {
		t.Fatalf("Demographic must be an object")
	}

	if demMap["birthDate"] != nil {
		t.Errorf("expected birthDate to be null, got %v", demMap["birthDate"])
	}

	if demMap["gender"] != nil {
		t.Errorf("expected gender to be null, got %v", demMap["gender"])
	}
}
