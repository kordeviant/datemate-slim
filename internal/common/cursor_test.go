package common

import (
	"testing"
	"time"
)

func TestCursorEncodeDecode(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Millisecond)
	orig := PageCursorData{
		Bucket:      "2026-11",
		PagingState: "page_state_token_123",
		Offset:      42,
		T:           now.UnixMilli(),
	}

	encoded, err := EncodeCursor(orig)
	if err != nil {
		t.Fatalf("failed to encode cursor: %v", err)
	}

	decoded, err := DecodeCursor(encoded)
	if err != nil {
		t.Fatalf("failed to decode cursor: %v", err)
	}

	if decoded.Bucket != orig.Bucket {
		t.Errorf("bucket mismatch: expected %s, got %s", orig.Bucket, decoded.Bucket)
	}
	if decoded.PagingState != orig.PagingState {
		t.Errorf("pagingState mismatch: expected %s, got %s", orig.PagingState, decoded.PagingState)
	}
	if decoded.Offset != orig.Offset {
		t.Errorf("offset mismatch: expected %d, got %d", orig.Offset, decoded.Offset)
	}
	if decoded.T != orig.T {
		t.Errorf("timestamp mismatch: expected %d, got %d", orig.T, decoded.T)
	}
}

func TestCursorEmptyDecode(t *testing.T) {
	_, err := DecodeCursor("")
	if err == nil {
		t.Fatal("expected error on empty cursor, got nil")
	}
}
