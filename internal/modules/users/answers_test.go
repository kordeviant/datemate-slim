package users

import (
	"encoding/json"
	"testing"
)

func TestProfileNestedResponseDto_AnswersSerialization(t *testing.T) {
	answersMap := map[string]interface{}{
		"1": 0,
		"2": []int{0, 2},
		"3": 1,
	}

	dto := ProfileNestedResponseDto{
		FullName:         nil,
		Avatar:           "https://cdn.example.com/avatar.jpg",
		ProfileCompleted: true,
		Answers:          answersMap,
	}

	bytes, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal ProfileNestedResponseDto: %v", err)
	}

	var rawMap map[string]interface{}
	if err := json.Unmarshal(bytes, &rawMap); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	ansRaw, ok := rawMap["Answers"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'Answers' to be an object, got %v", rawMap["Answers"])
	}

	if ansRaw["1"] != float64(0) {
		t.Errorf("expected question 1 answer to be index 0, got %v", ansRaw["1"])
	}

	arr2, ok := ansRaw["2"].([]interface{})
	if !ok || len(arr2) != 2 {
		t.Fatalf("expected question 2 answers to be an array of length 2, got %v", ansRaw["2"])
	}
	if arr2[0] != float64(0) || arr2[1] != float64(2) {
		t.Errorf("expected question 2 answers [0, 2], got %v", arr2)
	}

	if ansRaw["3"] != float64(1) {
		t.Errorf("expected question 3 answer to be index 1, got %v", ansRaw["3"])
	}
}
