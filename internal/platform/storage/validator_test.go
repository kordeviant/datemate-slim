package storage

import (
	"testing"
)

func TestDetectMimeType(t *testing.T) {
	// JPEG header
	jpegData := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46}
	if got := DetectMimeType(jpegData); got != "image/jpeg" {
		t.Errorf("expected image/jpeg, got %s", got)
	}

	// PNG header
	pngData := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00}
	if got := DetectMimeType(pngData); got != "image/png" {
		t.Errorf("expected image/png, got %s", got)
	}

	// WebP header
	webpData := []byte{'R', 'I', 'F', 'F', 0x00, 0x00, 0x00, 0x00, 'W', 'E', 'B', 'P'}
	if got := DetectMimeType(webpData); got != "image/webp" {
		t.Errorf("expected image/webp, got %s", got)
	}
}

func TestValidateFilename(t *testing.T) {
	valid := []string{"photo.jpg", "avatar.png", "image.webp"}
	for _, f := range valid {
		if err := ValidateFilename(f); err != nil {
			t.Errorf("expected valid for %s, got error: %v", f, err)
		}
	}

	invalid := []string{"malicious.exe", "script.sh", "backdoor.php"}
	for _, f := range invalid {
		if err := ValidateFilename(f); err == nil {
			t.Errorf("expected error for %s, got nil", f)
		}
	}
}
