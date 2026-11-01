package matching

import (
	"encoding/json"
	"testing"
)

func TestFeedDataDto_Serialization(t *testing.T) {
	name := "Alice"
	city := "Tehran"
	age := 25
	pic := "https://cdn.example.com/photo.jpg"
	un := "alice"

	dto := FeedDataDto{
		Candidates: []FeedCandidateDto{
			{
				ID:             1,
				FullName:       &name,
				City:           &city,
				Age:            &age,
				ProfilePicture: &pic,
				AvatarUrl:      &pic,
				Username:       &un,
				Gallery: []FeedGalleryItemDto{
					{
						ID:               10,
						ImageUrl:         pic,
						IsProfilePicture: true,
					},
				},
			},
		},
		Count: 1,
	}

	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal FeedDataDto: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if raw["count"] != float64(1) {
		t.Errorf("expected count 1, got %v", raw["count"])
	}

	candidates, ok := raw["candidates"].([]interface{})
	if !ok || len(candidates) != 1 {
		t.Fatalf("expected candidates array of length 1, got %v", raw["candidates"])
	}

	c0 := candidates[0].(map[string]interface{})
	if c0["profilePicture"] != pic {
		t.Errorf("expected profilePicture %s, got %v", pic, c0["profilePicture"])
	}
	if c0["fullName"] != name {
		t.Errorf("expected fullName %s, got %v", name, c0["fullName"])
	}
}
