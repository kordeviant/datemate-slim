package friends

import "time"

type FriendItemDto struct {
	ID        int        `json:"id"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
	FullName  *string    `json:"fullName"`
	Username  *string    `json:"username"`
	AvatarUrl *string    `json:"avatarUrl"`
}

type PaginatedFriendsDataDto struct {
	Items      []FriendItemDto `json:"items"`
	Total      int             `json:"total"`
	Page       int             `json:"page"`
	Limit      int             `json:"limit"`
	TotalPages int             `json:"totalPages"`
}

type AddFriendPayload struct {
	UserID int `json:"userId"`
}

type FriendRequestsQuery struct {
	Type   string // "received" | "sent"
	Status string // "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED"
	Page   int
	Limit  int
}

type FriendsQuery struct {
	Page   int
	Limit  int
	Search string
}
