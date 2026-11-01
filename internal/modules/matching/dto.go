package matching

type FeedGalleryItemDto struct {
	ID               int    `json:"id"`
	ImageUrl         string `json:"imageUrl"`
	IsProfilePicture bool   `json:"isProfilePicture"`
}

type FeedCandidateDto struct {
	ID        int                  `json:"id"`
	FullName  *string              `json:"fullName"`
	City      *string              `json:"city"`
	Age       *int                 `json:"age"`
	AvatarUrl *string              `json:"avatarUrl"`
	Username  *string              `json:"username"`
	Gallery   []FeedGalleryItemDto `json:"gallery"`
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
