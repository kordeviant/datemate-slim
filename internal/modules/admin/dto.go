package admin

import "time"

type AdminDashboardStatsDto struct {
	TotalUsers     int64 `json:"totalUsers"`
	OnlineUsers    int64 `json:"onlineUsers"`
	PendingSelfies int64 `json:"pendingSelfies"`
	PendingTickets int64 `json:"pendingTickets"`
}

type AdminDashboardOverviewDto struct {
	Stats          AdminDashboardStatsDto `json:"stats"`
	WeeklyActivity []map[string]interface{} `json:"weeklyActivity"`
	GenderStats    map[string]int64      `json:"genderStats"`
	RecentSelfies  []interface{}          `json:"recentSelfies"`
}

type AdminUserItemDto struct {
	ID               int32      `json:"id"`
	Email            string     `json:"email"`
	FirstName        *string    `json:"firstName"`
	Username         *string    `json:"username"`
	AvatarUrl        *string    `json:"avatarUrl"`
	SelfieUrl        *string    `json:"selfieUrl"`
	Gender           *string    `json:"gender"`
	BirthDate        *string    `json:"birthDate"`
	ProfileValidated bool       `json:"profileValidated"`
	IsPremium        bool       `json:"isPremium"`
	IsBanned         bool       `json:"isBanned"`
	BannedUntil      *time.Time `json:"bannedUntil,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
}

type AdminUsersListResponseDto struct {
	Items      []AdminUserItemDto `json:"items"`
	Total      int64              `json:"total"`
	Page       int                `json:"page"`
	Limit      int                `json:"limit"`
	TotalPages int                `json:"totalPages"`
}

type AdminCountDto struct {
	Count int64 `json:"count"`
}

type BanUserPayload struct {
	DurationDays *int    `json:"durationDays,omitempty"`
	Reason       *string `json:"reason,omitempty"`
}

type RejectVerificationPayload struct {
	Reason *string `json:"reason,omitempty"`
}

type AdminVerificationItemDto struct {
	ID        int32     `json:"id"`
	UserID    int32     `json:"userId"`
	Email     string    `json:"email"`
	FullName  *string   `json:"fullName"`
	Username  *string   `json:"username"`
	AvatarUrl *string   `json:"avatarUrl"`
	SelfieUrl string    `json:"selfieUrl"`
	CreatedAt time.Time `json:"createdAt"`
}

type AdminVerificationsListResponseDto struct {
	Items      []AdminVerificationItemDto `json:"items"`
	Total      int64                      `json:"total"`
	Page       int                        `json:"page"`
	Limit      int                        `json:"limit"`
	TotalPages int                        `json:"totalPages"`
}
