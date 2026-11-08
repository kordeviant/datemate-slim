package test

import (
	"testing"

	"datemate/internal/common"
	"datemate/internal/modules/users"
	"datemate/internal/platform/database/db"

	"github.com/jackc/pgx/v5/pgtype"
)

// TestHasValidPhotoRule validates the detection of valid user photos vs placeholders/defaults
func TestHasValidPhotoRule(t *testing.T) {
	invalidCases := []string{
		"",
		"   ",
		"/assets/avatars/default.png",
		"/assets/avatars/default.jpg",
		"/assets/avatars/default.webp",
		"/assets/avatars/default.svg",
		"http://dev-datemate.testdevvvv.site/assets/avatars/default.png",
		"/assets/avatars/DEFAULT.PNG",
		"https://example.com/images/placeholder.jpg",
		"default-avatar.png",
	}

	for _, c := range invalidCases {
		if common.HasValidPhoto(c) {
			t.Errorf("expected photo %q to be invalid, but got valid", c)
		}
	}

	validCases := []string{
		"/assets/images/gallery_1_938472.webp",
		"/assets/avatars/avatar_2_102938.webp",
		"/assets/avatars/f1.jpg",
		"/assets/avatars/m2.jpg",
		"https://cdn.datemate.com/profiles/u123.jpg",
	}

	for _, c := range validCases {
		if !common.HasValidPhoto(c) {
			t.Errorf("expected photo %q to be valid, but got invalid", c)
		}
	}
}

// TestExploreFeed_RequiresProfilePicture verifies that candidates without a real profile picture are excluded from Feed
func TestExploreFeed_RequiresProfilePicture(t *testing.T) {
	// Candidate 1: Has only default avatar and no gallery
	c1Galleries := []db.UserGalleries{}
	c1Avatar := "/assets/avatars/default.png"
	c1ProfilePic := pgtype.Text{Valid: false}

	// Resolution simulation matching matching.Service.processRow
	var primaryPhoto1 string
	for _, g := range c1Galleries {
		if g.IsProfilePicture && common.HasValidPhoto(g.ImageUrl) {
			primaryPhoto1 = g.ImageUrl
			break
		}
	}
	if primaryPhoto1 == "" && c1ProfilePic.Valid && common.HasValidPhoto(c1ProfilePic.String) {
		primaryPhoto1 = c1ProfilePic.String
	}
	if primaryPhoto1 == "" && common.HasValidPhoto(c1Avatar) {
		primaryPhoto1 = c1Avatar
	}

	if common.HasValidPhoto(primaryPhoto1) {
		t.Fatalf("Candidate 1 with default avatar must be rejected from Feed, but resolved to %q", primaryPhoto1)
	}

	// Candidate 2: Has valid gallery photo
	c2Galleries := []db.UserGalleries{
		{ID: 10, UserID: 2, ImageUrl: "/assets/images/gallery_2_abc.webp", IsProfilePicture: true},
	}
	c2Avatar := "/assets/avatars/default.png"
	c2ProfilePic := pgtype.Text{Valid: false}

	var primaryPhoto2 string
	for _, g := range c2Galleries {
		if g.IsProfilePicture && common.HasValidPhoto(g.ImageUrl) {
			primaryPhoto2 = g.ImageUrl
			break
		}
	}
	if primaryPhoto2 == "" && c2ProfilePic.Valid && common.HasValidPhoto(c2ProfilePic.String) {
		primaryPhoto2 = c2ProfilePic.String
	}
	if primaryPhoto2 == "" && common.HasValidPhoto(c2Avatar) {
		primaryPhoto2 = c2Avatar
	}

	if !common.HasValidPhoto(primaryPhoto2) {
		t.Fatalf("Candidate 2 with gallery photo must be accepted in Feed")
	}
	if primaryPhoto2 != "/assets/images/gallery_2_abc.webp" {
		t.Fatalf("Expected primaryPhoto2 to be %q, got %q", "/assets/images/gallery_2_abc.webp", primaryPhoto2)
	}
}

// TestRecommended_RequiresAvatar verifies that candidates without avatar or photo are excluded from recommendations
func TestRecommended_RequiresAvatar(t *testing.T) {
	// Simulate candidate list with and without valid avatar
	candidates := []struct {
		id                int32
		avatarUrl         string
		profilePictureUrl pgtype.Text
		galleries         []db.UserGalleries
		shouldBeIncluded  bool
	}{
		{
			id:                1,
			avatarUrl:         "/assets/avatars/default.png",
			profilePictureUrl: pgtype.Text{Valid: false},
			galleries:         nil,
			shouldBeIncluded:  false, // default avatar only
		},
		{
			id:                2,
			avatarUrl:         "",
			profilePictureUrl: pgtype.Text{Valid: false},
			galleries:         nil,
			shouldBeIncluded:  false, // empty
		},
		{
			id:                3,
			avatarUrl:         "/assets/avatars/f1.jpg",
			profilePictureUrl: pgtype.Text{Valid: false},
			galleries:         nil,
			shouldBeIncluded:  true, // valid avatar
		},
		{
			id:                4,
			avatarUrl:         "/assets/avatars/default.png",
			profilePictureUrl: pgtype.Text{String: "/assets/images/gallery_4_xyz.webp", Valid: true},
			galleries:         nil,
			shouldBeIncluded:  true, // valid profile_picture_url
		},
	}

	var acceptedIDs []int32
	for _, c := range candidates {
		photo := ""
		if c.profilePictureUrl.Valid && common.HasValidPhoto(c.profilePictureUrl.String) {
			photo = c.profilePictureUrl.String
		} else if common.HasValidPhoto(c.avatarUrl) {
			photo = c.avatarUrl
		} else {
			for _, g := range c.galleries {
				if g.IsProfilePicture && common.HasValidPhoto(g.ImageUrl) {
					photo = g.ImageUrl
					break
				}
			}
			if photo == "" && len(c.galleries) > 0 && common.HasValidPhoto(c.galleries[0].ImageUrl) {
				photo = c.galleries[0].ImageUrl
			}
		}

		if !common.HasValidPhoto(photo) {
			if c.shouldBeIncluded {
				t.Errorf("Candidate %d expected to be included, but was filtered out", c.id)
			}
			continue
		}

		if !c.shouldBeIncluded {
			t.Errorf("Candidate %d expected to be filtered out, but was included with photo %s", c.id, photo)
		}
		acceptedIDs = append(acceptedIDs, c.id)
	}

	if len(acceptedIDs) != 2 || acceptedIDs[0] != 3 || acceptedIDs[1] != 4 {
		t.Fatalf("Expected acceptedIDs [3, 4], got %v", acceptedIDs)
	}
}

// TestUserProfileCompleted_RequiresValidPhoto verifies that profileCompleted requires a real photo
func TestUserProfileCompleted_RequiresValidPhoto(t *testing.T) {
	// User with default avatar and no gallery
	user1FirstName := "John"
	user1Avatar := "/assets/avatars/default.png"
	user1Gender := "MALE"
	var user1Galleries []users.GalleryItemResponseDto

	completed1 := user1FirstName != "" && (common.HasValidPhoto(user1Avatar) || len(user1Galleries) > 0) && user1Gender != ""
	if completed1 {
		t.Errorf("User 1 with default avatar should not have profileCompleted=true")
	}

	// User with uploaded avatar
	user2Avatar := "/assets/avatars/avatar_2_abc.webp"
	completed2 := user1FirstName != "" && (common.HasValidPhoto(user2Avatar) || len(user1Galleries) > 0) && user1Gender != ""
	if !completed2 {
		t.Errorf("User 2 with real avatar should have profileCompleted=true")
	}
}
