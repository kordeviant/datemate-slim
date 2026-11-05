package matching

import "encoding/json"

type FeedGalleryItemDto struct {
	ID               int    `json:"id"`
	ImageUrl         string `json:"imageUrl"`
	IsProfilePicture bool   `json:"isProfilePicture"`
}

type FeedCandidateDto struct {
	ID             int                  `json:"id"`
	FullName       *string              `json:"fullName"`
	City           *string              `json:"city"`
	Age            *int                 `json:"age"`
	ProfilePicture *string              `json:"profilePicture"`
	AvatarUrl      *string              `json:"avatarUrl,omitempty"`
	Username       *string              `json:"username"`
	Gallery        []FeedGalleryItemDto `json:"gallery,omitempty"`
}

type FeedDataDto struct {
	Candidates []FeedCandidateDto `json:"candidates"`
	Count      int                `json:"count"`
}

func (d FeedDataDto) MarshalJSON() ([]byte, error) {
	cands := d.Candidates
	if cands == nil {
		cands = make([]FeedCandidateDto, 0)
	}
	type Alias FeedDataDto
	return json.Marshal(&struct {
		Candidates []FeedCandidateDto `json:"candidates"`
		Alias
	}{
		Candidates: cands,
		Alias:      (Alias)(d),
	})
}

type SwipeRequestDto struct {
	TargetUserID int64  `json:"targetUserId"`
	Direction    string `json:"direction"` // "RIGHT" or "LEFT"
}

type LikedUserDto struct {
	ID        int     `json:"id"`
	FullName  *string `json:"fullName"`
	Username  *string `json:"username"`
	City      *string `json:"city"`
	IsOnline  bool    `json:"isOnline"`
	AvatarUrl *string `json:"avatarUrl"`
}
