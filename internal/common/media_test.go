package common

import "testing"

func TestHasValidPhoto(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"", false},
		{"   ", false},
		{"/assets/avatars/default.png", false},
		{"http://example.com/assets/avatars/default.png", false},
		{"/assets/avatars/DEFAULT.PNG", false},
		{"placeholder.jpg", false},
		{"/assets/avatars/default-avatar.svg", false},
		{"/assets/avatars/m1.jpg", true},
		{"/assets/avatars/f1.jpg", true},
		{"/assets/images/gallery_1_abc.webp", true},
		{"https://cdn.example.com/photos/profile123.jpg", true},
	}

	for _, tt := range tests {
		got := HasValidPhoto(tt.input)
		if got != tt.want {
			t.Errorf("HasValidPhoto(%q) = %v; want %v", tt.input, got, tt.want)
		}
	}
}
