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
	DurationHours *int    `json:"durationHours,omitempty"`
	DurationDays  *int    `json:"durationDays,omitempty"`
	Reason        *string `json:"reason,omitempty"`
}

type AdminUserGalleryItemDto struct {
	ID         int32  `json:"id"`
	URL        string `json:"url"`
	LikesCount int32  `json:"likesCount"`
	CreatedAt  string `json:"createdAt"`
}

type AdminUserDemographicDto struct {
	BirthDate      *string `json:"birthDate"`
	Gender         *string `json:"gender"`
	Age            *int    `json:"age"`
	CityName       *string `json:"cityName"`
	Job            *string `json:"job"`
	Degree         *string `json:"degree"`
	Height         *int    `json:"height"`
	Weight         *int    `json:"weight"`
	Religion       *string `json:"religion"`
	RelationStatus *string `json:"relationStatus"`
}

type AdminUserDeviceDto struct {
	ID         int32   `json:"id"`
	DeviceInfo string  `json:"deviceInfo"`
	FcmToken   *string `json:"fcmToken"`
	IsActive   bool    `json:"isActive"`
	ExpiresAt  string  `json:"expiresAt"`
	CreatedAt  string  `json:"createdAt"`
}

type AdminUserLikeDto struct {
	ID        int32   `json:"id"`
	UserID    int32   `json:"userId"`
	FullName  string  `json:"fullName"`
	Username  *string `json:"username"`
	AvatarUrl *string `json:"avatarUrl"`
	City      *string `json:"city"`
	Type      string  `json:"type"`
	CreatedAt string  `json:"createdAt"`
}

type AdminUserDetailsDto struct {
	ID               int32                     `json:"id"`
	Email            string                    `json:"email"`
	Role             string                    `json:"role"`
	Language         string                    `json:"language"`
	FullName         string                    `json:"fullName"`
	Username         *string                   `json:"username"`
	City             *string                   `json:"city"`
	PhoneNumber      *string                   `json:"phoneNumber"`
	Bio              *string                   `json:"bio"`
	Gender           *string                   `json:"gender"`
	Age              *int                      `json:"age"`
	AvatarUrl        *string                   `json:"avatarUrl"`
	SelfieUrl        *string                   `json:"selfieUrl"`
	ProfileValidated bool                      `json:"profileValidated"`
	HasPendingSelfie bool                      `json:"hasPendingSelfie"`
	BannedUntil      *string                   `json:"bannedUntil"`
	IsBanned         bool                      `json:"isBanned"`
	IsPremium        bool                      `json:"isPremium"`
	CreatedAt        string                    `json:"createdAt"`
	Gallery          []AdminUserGalleryItemDto `json:"gallery"`
	Demographic      *AdminUserDemographicDto  `json:"demographic"`
	Interests        []string                  `json:"interests"`
	Devices          []AdminUserDeviceDto      `json:"devices"`
	Likes            []AdminUserLikeDto        `json:"likes"`
}

type AdminUpdateUserPayload struct {
	ConfirmSelfie    *bool       `json:"confirmSelfie,omitempty"`
	SelfieVerified   *bool       `json:"selfieVerified,omitempty"`
	ProfileValidated *bool       `json:"profileValidated,omitempty"`
	Bio              *string     `json:"bio,omitempty"`
	FullName         *string     `json:"fullName,omitempty"`
	Username         *string     `json:"username,omitempty"`
	PhoneNumber      *string     `json:"phoneNumber,omitempty"`
	IsPremium        *bool       `json:"isPremium,omitempty"`
	Role             *string     `json:"role,omitempty"`
	LikedActivities  interface{} `json:"likedActivities,omitempty"`
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
