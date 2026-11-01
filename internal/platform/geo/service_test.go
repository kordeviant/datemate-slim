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
