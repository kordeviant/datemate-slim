package geo

import (
	"testing"
)

func TestNormalizeCityQuery(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"تهران", "تهران"},
		{"كرمان", "کرمان"},
		{"خرم\u200Cآباد", "خرم آباد"},
		{" مشهد ", "مشهد"},
	}

	for _, tt := range tests {
		got := NormalizeCityQuery(tt.input)
		if got != tt.expected {
			t.Errorf("NormalizeCityQuery(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestPersianToEnglishCityMap(t *testing.T) {
	if PersianToEnglishCityMap["تهران"] != "Tehran" {
		t.Errorf("expected 'Tehran', got '%s'", PersianToEnglishCityMap["تهران"])
	}
	if PersianToEnglishCityMap["اصفهان"] != "Isfahan" {
		t.Errorf("expected 'Isfahan', got '%s'", PersianToEnglishCityMap["اصفهان"])
	}
	if PersianToEnglishCityMap["شیراز"] != "Shiraz" {
		t.Errorf("expected 'Shiraz', got '%s'", PersianToEnglishCityMap["شیراز"])
	}
}

func TestGeoDataLinkingAndParity(t *testing.T) {
	svc := NewService("data/geo")
	if len(svc.countries) == 0 {
		t.Skip("geo data directory not found in relative path, skipping")
	}

	// 1. Iran (country 103) states
	states := svc.GetStates(103, "")
	if len(states) != 31 {
		t.Fatalf("expected 31 states for Iran (103), got %d", len(states))
	}
	for _, st := range states {
		if st.CountryID != 103 {
			t.Errorf("expected state %s to have countryId 103, got %d", st.Name, st.CountryID)
		}
	}

	// 2. Tehran state (3945) cities
	cities, total := svc.GetCities(3945, 0, "", 100, 0)
	if total == 0 || len(cities) == 0 {
		t.Fatalf("expected cities for Tehran state (3945), got total=%d", total)
	}
	for _, c := range cities {
		if c.StateID != 3945 {
			t.Errorf("expected city %s to have stateId 3945, got %d", c.Name, c.StateID)
		}
	}

	// 3. Iran country (103) cities
	iranCities, totalIran := svc.GetCities(0, 103, "", 50, 0)
	if totalIran == 0 || len(iranCities) == 0 {
		t.Fatalf("expected cities for Iran (103), got total=%d", totalIran)
	}

	// 4. ResolveCityHierarchy for City 1 (Andorra la Vella, stateId 488, countryId 6)
	c, st, co, ok := svc.ResolveCityHierarchy(1)
	if !ok || c == nil {
		t.Fatalf("failed to resolve city 1")
	}
	if c.StateID != 488 {
		t.Errorf("expected city 1 stateId=488, got %d", c.StateID)
	}
	if st == nil || st.ID != 488 {
		t.Errorf("expected resolved state ID=488, got %v", st)
	}
	if co == nil || co.ID != 6 {
		t.Errorf("expected resolved country ID=6, got %v", co)
	}
}
