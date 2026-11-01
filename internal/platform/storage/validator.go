package storage

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

var DangerousExtensions = map[string]bool{
	".exe": true, ".bat": true, ".cmd": true, ".sh": true,
	".php": true, ".phtml": true, ".pl": true, ".cgi": true,
	".js": true, ".mjs": true, ".vbs": true, ".msi": true,
	".dll": true, ".so": true, ".bin": true, ".com": true,
	".scr": true, ".vbe": true, ".wsf": true, ".wsh": true,
	".apk": true, ".jar": true,
}

var dangerousSVGPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)<\s*script\b`),
	regexp.MustCompile(`(?i)javascript:`),
	regexp.MustCompile(`(?i)\bon\w+\s*=`), // onclick=, onerror=, onload=
	regexp.MustCompile(`(?i)<iframe`),
	regexp.MustCompile(`(?i)<object`),
	regexp.MustCompile(`(?i)<embed`),
}

func ValidateFilename(filename string) error {
	ext := strings.ToLower(filepath.Ext(filename))
	if DangerousExtensions[ext] {
		return fmt.Errorf("dangerous file extension %s is prohibited", ext)
	}
	return nil
}

func DetectMimeType(data []byte) string {
	if len(data) < 4 {
		return ""
	}

	// JPEG: FF D8 FF
	if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return "image/jpeg"
	}

	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if len(data) >= 8 &&
		data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 &&
		data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A {
		return "image/png"
	}

	// WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
	if len(data) >= 12 &&
		data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' &&
		data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P' {
		return "image/webp"
	}

	// GIF: GIF87a or GIF89a
	if len(data) >= 6 &&
		data[0] == 'G' && data[1] == 'I' && data[2] == 'F' && data[3] == '8' &&
		(data[4] == '7' || data[4] == '9') && data[5] == 'a' {
		return "image/gif"
	}

	// PDF: %PDF-
	if len(data) >= 5 &&
		data[0] == 0x25 && data[1] == 0x50 && data[2] == 0x44 && data[3] == 0x46 && data[4] == 0x2D {
		return "application/pdf"
	}

	// SVG text check
	prefix := strings.ToLower(string(data[:min(1024, len(data))]))
	if strings.Contains(prefix, "<svg") || (strings.HasPrefix(prefix, "<?xml") && strings.Contains(prefix, "<svg")) {
		return "image/svg+xml"
	}

	return ""
}

func ValidateAndSanitizeSVG(data []byte) error {
	for _, pat := range dangerousSVGPatterns {
		if pat.Match(data) {
			return errors.New("SVG contains prohibited executable scripts or active event handlers")
		}
	}
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func ValidateAssetUpload(assetType, filename string, data []byte, allowedMimes []string, maxBytes int64) (string, error) {
	if err := ValidateFilename(filename); err != nil {
		return "", err
	}

	if int64(len(data)) > maxBytes {
		return "", fmt.Errorf("file size (%d bytes) exceeds maximum allowed size of %d bytes", len(data), maxBytes)
	}

	mimeType := DetectMimeType(data)
	if mimeType == "" {
		// Fallback to checking extension if audio/video
		ext := strings.ToLower(filepath.Ext(filename))
		if strings.HasPrefix(assetType, "audio") || ext == ".mp3" || ext == ".ogg" || ext == ".wav" || ext == ".aac" || ext == ".m4a" {
			mimeType = "audio/mpeg"
		} else if ext == ".mp4" || ext == ".mov" || ext == ".webm" {
			mimeType = "video/mp4"
		}
	}

	if mimeType == "image/svg+xml" {
		if err := ValidateAndSanitizeSVG(data); err != nil {
			return "", err
		}
	}

	if len(allowedMimes) > 0 {
		allowed := false
		for _, m := range allowedMimes {
			if strings.EqualFold(m, mimeType) {
				allowed = true
				break
			}
		}
		if !allowed {
			return "", fmt.Errorf("file format %q is not permitted for asset type %q", mimeType, assetType)
		}
	}

	return mimeType, nil
}
