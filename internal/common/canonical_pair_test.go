package common

import (
	"testing"
)

func TestCanonicalPairKey(t *testing.T) {
	key1, err := CreatePairKey(10, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	key2, err := CreatePairKey(20, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if key1 != "10:20" {
		t.Errorf("expected '10:20', got '%s'", key1)
	}
	if key1 != key2 {
		t.Errorf("expected canonical pair keys to match: %s != %s", key1, key2)
	}

	_, err = CreatePairKey(10, 10)
	if err == nil {
		t.Error("expected error for self-pair key, got nil")
	}

	// Test deterministic conversation ID
	convID1 := GenerateDeterministicConversationID(key1)
	convID2 := GenerateDeterministicConversationID(key2)
	if convID1 != convID2 {
		t.Errorf("expected identical conversation UUIDs, got %s != %s", convID1, convID2)
	}
}
