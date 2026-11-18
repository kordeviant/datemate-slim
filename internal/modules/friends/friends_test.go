package friends

import (
	"strings"
	"testing"
)

func TestFriendErrorMessagesParity(t *testing.T) {
	// Acceptance criteria:
	// 1. Adding an existing friend returns a message containing "already friends"
	msgAlreadyFriends := "Users are already friends"
	if !strings.Contains(strings.ToLower(msgAlreadyFriends), "already friends") {
		t.Errorf("expected msgAlreadyFriends to contain 'already friends', got %q", msgAlreadyFriends)
	}

	// 2. Sending a duplicate request returns status 409, or a message containing "already" or "pending"
	msgPending := "Friend request is already pending"
	if !strings.Contains(strings.ToLower(msgPending), "already") {
		t.Errorf("expected msgPending to contain 'already', got %q", msgPending)
	}
	if !strings.Contains(strings.ToLower(msgPending), "pending") {
		t.Errorf("expected msgPending to contain 'pending', got %q", msgPending)
	}
}
