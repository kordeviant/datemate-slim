package interests

import (
	"encoding/json"
	"testing"
)

func TestInterestCategoryResponseDto_Serialization(t *testing.T) {
	catName := "Sports"
	inName := "Football"
	cID := 1

	item := InterestItemResponseDto{
		ID:         10,
		En:         inName,
		Fa:         "فوتبال",
		CategoryID: &cID,
		Name:       &inName,
		EnName:     &inName,
		FaName:     &inName,
	}

	dto := InterestCategoryResponseDto{
		ID:        1,
		En:        catName,
		Fa:        "ورزش",
		Interest:  []InterestItemResponseDto{item},
		Interests: []InterestItemResponseDto{item},
		Name:      &catName,
		EnName:    &catName,
		FaName:    &catName,
	}

	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal InterestCategoryResponseDto: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if raw["name"] != catName {
		t.Errorf("expected name %s, got %v", catName, raw["name"])
	}

	// Verify both Interest and interests arrays exist for mobile compatibility
	if _, ok := raw["Interest"].([]interface{}); !ok {
		t.Errorf("expected Interest array to exist")
	}
	if _, ok := raw["interests"].([]interface{}); !ok {
		t.Errorf("expected interests array to exist")
	}
}
