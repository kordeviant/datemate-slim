package common

import (
	"strings"
)

// HasValidPhoto checks if the provided photo path or URL is valid and not a placeholder/default.
func HasValidPhoto(photo string) bool {
	p := strings.TrimSpace(photo)
	if p == "" {
		return false
	}
	pLower := strings.ToLower(p)
	if strings.Contains(pLower, "default.png") ||
		strings.Contains(pLower, "default.jpg") ||
		strings.Contains(pLower, "default.webp") ||
		strings.Contains(pLower, "default.svg") ||
		strings.Contains(pLower, "default-avatar") ||
		strings.Contains(pLower, "placeholder") {
		return false
	}
	return true
}
