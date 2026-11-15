package common

import (
	"testing"
)

func TestResolveAssetURL(t *testing.T) {
	baseURL := "https://api.datemate.app"

	tests := []struct {
		name     string
		baseURL  string
		raw      string
		expected string
	}{
		{
			name:     "empty string",
			baseURL:  baseURL,
			raw:      "",
			expected: "",
		},
		{
			name:     "whitespace only",
			baseURL:  baseURL,
			raw:      "   ",
			expected: "",
		},
		{
			name:     "external CDN URL preserved",
			baseURL:  baseURL,
			raw:      "https://cdn.example.com/avatar.jpg",
			expected: "https://cdn.example.com/avatar.jpg",
		},
		{
			name:     "http external CDN URL preserved",
			baseURL:  baseURL,
			raw:      "http://images.unsplash.com/photo-123.jpg",
			expected: "http://images.unsplash.com/photo-123.jpg",
		},
		{
			name:     "localhost URL rebased to baseURL",
			baseURL:  baseURL,
			raw:      "http://localhost:3000/assets/avatars/user1.webp",
			expected: "https://api.datemate.app/assets/avatars/user1.webp",
		},
		{
			name:     "localhost legacy uploads URL rebased and normalized to /assets/",
			baseURL:  baseURL,
			raw:      "http://localhost:3000/uploads/avatars/avatar_10_44087749.webp",
			expected: "https://api.datemate.app/assets/avatars/avatar_10_44087749.webp",
		},
		{
			name:     "127.0.0.1 URL rebased to baseURL",
			baseURL:  baseURL,
			raw:      "http://127.0.0.1:2021/uploads/images/gallery_10.webp",
			expected: "https://api.datemate.app/assets/images/gallery_10.webp",
		},
		{
			name:     "relative path with uploads/ prefix",
			baseURL:  baseURL,
			raw:      "uploads/avatars/avatar_10_44087749.webp",
			expected: "https://api.datemate.app/assets/avatars/avatar_10_44087749.webp",
		},
		{
			name:     "leading slash with /uploads/ prefix",
			baseURL:  baseURL,
			raw:      "/uploads/selfies/selfie_123.webp",
			expected: "https://api.datemate.app/assets/selfies/selfie_123.webp",
		},
		{
			name:     "relative path with assets/ prefix",
			baseURL:  baseURL,
			raw:      "assets/icons/sport.svg",
			expected: "https://api.datemate.app/assets/icons/sport.svg",
		},
		{
			name:     "leading slash with /assets/ prefix",
			baseURL:  baseURL,
			raw:      "/assets/avatars/default.png",
			expected: "https://api.datemate.app/assets/avatars/default.png",
		},
		{
			name:     "category and filename without assets prefix",
			baseURL:  baseURL,
			raw:      "avatars/avatarbe9c29b29330.webp",
			expected: "https://api.datemate.app/assets/avatars/avatarbe9c29b29330.webp",
		},
		{
			name:     "images category and filename",
			baseURL:  baseURL,
			raw:      "images/photo-1517841905240-472988babdf9.webp",
			expected: "https://api.datemate.app/assets/images/photo-1517841905240-472988babdf9.webp",
		},
		{
			name:     "bare filename defaults to images category",
			baseURL:  baseURL,
			raw:      "photo-123.webp",
			expected: "https://api.datemate.app/assets/images/photo-123.webp",
		},
		{
			name:     "baseURL with trailing slash",
			baseURL:  "https://api.datemate.app/",
			raw:      "avatars/user.webp",
			expected: "https://api.datemate.app/assets/avatars/user.webp",
		},
		{
			name:     "empty baseURL defaults to localhost:3000",
			baseURL:  "",
			raw:      "avatars/user.webp",
			expected: "http://localhost:3000/assets/avatars/user.webp",
		},
		{
			name:     "chat attachment bare uploads path",
			baseURL:  baseURL,
			raw:      "uploads/voice_note.ogg",
			expected: "https://api.datemate.app/uploads/voice_note.ogg",
		},
		{
			name:     "chat attachment uploads/chat path",
			baseURL:  baseURL,
			raw:      "uploads/chat/voice_note.ogg",
			expected: "https://api.datemate.app/uploads/voice_note.ogg",
		},
		{
			name:     "chat attachment container app path",
			baseURL:  baseURL,
			raw:      "/app/uploads/chat/voice_note.ogg",
			expected: "https://api.datemate.app/uploads/voice_note.ogg",
		},
		{
			name:     "chat attachment localhost url rebased",
			baseURL:  baseURL,
			raw:      "http://localhost:3000/uploads/voice_note.ogg",
			expected: "https://api.datemate.app/uploads/voice_note.ogg",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := ResolveAssetURL(tt.baseURL, tt.raw)
			if actual != tt.expected {
				t.Errorf("ResolveAssetURL(%q, %q) = %q; want %q", tt.baseURL, tt.raw, actual, tt.expected)
			}
		})
	}
}

