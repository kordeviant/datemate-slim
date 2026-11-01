package recommended

import (
	"testing"
)

func TestCalculateCityScore(t *testing.T) {
	city1 := int32(10)
	city2 := int32(10)
	city3 := int32(20)

	// Same city: max weight (20)
	if score := calculateCityScore(&city1, &city2, 20); score != 20 {
		t.Errorf("expected 20, got %d", score)
	}

	// Different city: 0
	if score := calculateCityScore(&city1, &city3, 20); score != 0 {
		t.Errorf("expected 0, got %d", score)
	}

	// Nil city: 0
	if score := calculateCityScore(nil, &city1, 20); score != 0 {
		t.Errorf("expected 0, got %d", score)
	}
}

func TestCalculateAgeScore(t *testing.T) {
	age25 := 25
	age27 := 27 // diff 2 <= 3 -> maxWeight (10)
	age30 := 30 // diff 5 <= 6 -> 6
	age34 := 34 // diff 9 <= 10 -> 3
	age45 := 45 // diff 20 > 10 -> 0

	if s := calculateAgeScore(&age25, &age27, 10); s != 10 {
		t.Errorf("diff 2: expected 10, got %d", s)
	}
	if s := calculateAgeScore(&age25, &age30, 10); s != 6 {
		t.Errorf("diff 5: expected 6, got %d", s)
	}
	if s := calculateAgeScore(&age25, &age34, 10); s != 3 {
		t.Errorf("diff 9: expected 3, got %d", s)
	}
	if s := calculateAgeScore(&age25, &age45, 10); s != 0 {
		t.Errorf("diff 20: expected 0, got %d", s)
	}
}
