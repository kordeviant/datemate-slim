package test

import (
	"testing"
	"time"

	"datemate/internal/common"
)

func TestP0_ChatTimelineCursorEncoding(t *testing.T) {
	now := time.Now().UTC()
	cursorData := common.PageCursorData{
		Bucket: common.GetBucket(now),
		T:      now.UnixMicro(),
	}

	encoded, err := common.EncodeCursor(cursorData)
	if err != nil {
		t.Fatalf("Failed to encode cursor: %v", err)
	}

	decoded, err := common.DecodeCursor(encoded)
	if err != nil {
		t.Fatalf("Failed to decode cursor: %v", err)
	}

	if decoded.Bucket != cursorData.Bucket {
		t.Errorf("Expected bucket %s, got %s", cursorData.Bucket, decoded.Bucket)
	}
	if decoded.T != cursorData.T {
		t.Errorf("Expected timestamp %d, got %d", cursorData.T, decoded.T)
	}

	// Verify microsecond resolution conversion back to time.Time
	reconTime := time.UnixMicro(decoded.T).UTC()
	if reconTime.Unix() != now.Unix() {
		t.Errorf("Reconstructed time mismatch: expected %v, got %v", now, reconTime)
	}
}

func TestP0_LegacyBucketCursorCompatibility(t *testing.T) {
	legacyData := common.PageCursorData{
		Bucket: "20261115",
		Offset: 30,
	}

	encoded, err := common.EncodeCursor(legacyData)
	if err != nil {
		t.Fatalf("Failed to encode legacy cursor: %v", err)
	}

	decoded, err := common.DecodeCursor(encoded)
	if err != nil {
		t.Fatalf("Failed to decode legacy cursor: %v", err)
	}

	if decoded.Bucket != "20261115" {
		t.Errorf("Expected bucket 20261115, got %s", decoded.Bucket)
	}
	if decoded.T != 0 {
		t.Errorf("Expected T to be 0 for legacy cursor, got %d", decoded.T)
	}
}
