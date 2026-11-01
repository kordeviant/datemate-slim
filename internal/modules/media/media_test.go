package media

import (
	"encoding/json"
	"testing"
)

func TestMediaUploadResponseDto_Serialization(t *testing.T) {
	dto := MediaUploadResponseDto{
		URL:          "http://localhost:3000/assets/icons/icons_123.svg",
		PublicURL:    "http://localhost:3000/assets/icons/icons_123.svg",
		FileName:     "icons_123.svg",
		Filename:     "icons_123.svg",
		AssetType:    "icons",
		RelativePath: "icons/icons_123.svg",
		MimeType:     "image/svg+xml",
		SizeBytes:    2048,
		CreatedAt:    "2026-11-01T12:00:00Z",
	}

	data, err := json.Marshal(dto)
	if err != nil {
		t.Fatalf("failed to marshal MediaUploadResponseDto: %v", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	// Verify both NestJS canonical and legacy fields exist
	if raw["publicUrl"] != dto.PublicURL {
		t.Errorf("expected publicUrl %s, got %v", dto.PublicURL, raw["publicUrl"])
	}
	if raw["filename"] != dto.Filename {
		t.Errorf("expected filename %s, got %v", dto.Filename, raw["filename"])
	}
	if raw["relativePath"] != dto.RelativePath {
		t.Errorf("expected relativePath %s, got %v", dto.RelativePath, raw["relativePath"])
	}
	if raw["assetType"] != dto.AssetType {
		t.Errorf("expected assetType %s, got %v", dto.AssetType, raw["assetType"])
	}
	if raw["sizeBytes"] != float64(2048) {
		t.Errorf("expected sizeBytes 2048, got %v", raw["sizeBytes"])
	}
}
