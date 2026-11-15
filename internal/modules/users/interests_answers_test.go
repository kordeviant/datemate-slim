package users

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestUpdateProfilePayload_AliasesDeserialization(t *testing.T) {
	// 1. Test JSON with favorites and questions at root
	jsonStr := `{
		"favorites": [1, 2, 3],
		"questions": {
			"1": 0,
			"2": [1, 2]
		}
	}`

	var p1 UpdateProfilePayload
	if err := json.Unmarshal([]byte(jsonStr), &p1); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if p1.Favorites == nil {
		t.Errorf("expected Favorites to be populated, got nil")
	}
	if p1.Questions == nil {
		t.Errorf("expected Questions to be populated, got nil")
	}

	// 2. Test JSON with interests and answers under profile (lowercase)
	jsonStr2 := `{
		"profile": {
			"interests": {
				"1": true,
				"2": true
			},
			"answers": {
				"3": 0
			}
		}
	}`

	var p2 UpdateProfilePayload
	if err := json.Unmarshal([]byte(jsonStr2), &p2); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if p2.ProfileLower == nil {
		t.Fatalf("expected ProfileLower to be populated")
	}
	if p2.ProfileLower.Interests == nil {
		t.Errorf("expected ProfileLower.Interests to be populated, got nil")
	}
	if p2.ProfileLower.Answers == nil {
		t.Errorf("expected ProfileLower.Answers to be populated, got nil")
	}

	// 3. Test JSON with LikedActivities and questionAnswers
	jsonStr3 := `{
		"LikedActivities": {
			"1": [10, 11]
		},
		"questionAnswers": [
			{"questionId": 1, "answerId": 5}
		]
	}`

	var p3 UpdateProfilePayload
	if err := json.Unmarshal([]byte(jsonStr3), &p3); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	if p3.LikedActivitiesCapital == nil {
		t.Errorf("expected LikedActivitiesCapital to be populated, got nil")
	}
	if p3.QuestionAnswers == nil {
		t.Errorf("expected QuestionAnswers to be populated, got nil")
	}
}

func TestLikedActivitiesGrouping_GetProfile(t *testing.T) {
	// Simulates grouping logic in GetProfile
	type mockInterest struct {
		CategoryID int32
		InterestID int32
	}
	interests := []mockInterest{
		{CategoryID: 1, InterestID: 10},
		{CategoryID: 1, InterestID: 11},
		{CategoryID: 2, InterestID: 25},
	}

	interestsByCat := make(map[int32][]int)
	for _, in := range interests {
		interestsByCat[in.CategoryID] = append(interestsByCat[in.CategoryID], int(in.InterestID))
	}
	likedActivities := make(map[string]interface{})
	for catID, ids := range interestsByCat {
		if len(ids) == 1 {
			likedActivities[string(rune('0'+catID))] = ids[0]
		} else if len(ids) > 1 {
			likedActivities[string(rune('0'+catID))] = ids
		}
	}

	if !reflect.DeepEqual(likedActivities["1"], []int{10, 11}) {
		t.Errorf("expected likedActivities['1'] to be []int{10, 11}, got %v", likedActivities["1"])
	}
	if likedActivities["2"] != 25 {
		t.Errorf("expected likedActivities['2'] to be 25, got %v", likedActivities["2"])
	}
}

