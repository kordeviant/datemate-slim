package chat

import (
	"encoding/json"
	"time"
)

type CreateConversationDto struct {
	Type           string  `json:"type"`                     // "direct" | "group" / "DIRECT" | "GROUP"
	TargetUserId   *int64  `json:"targetUserId,omitempty"`   // for DIRECT
	RecipientId    *int64  `json:"recipientId,omitempty"`    // alias for targetUserId
	Title          *string `json:"title,omitempty"`          // for GROUP
	Name           *string `json:"name,omitempty"`           // alias for title (legacy chat service / Swagger)
	ParticipantIds []int64 `json:"participantIds,omitempty"` // for DIRECT and GROUP
}

type LastMessageDto struct {
	MessageID string  `json:"messageId,omitempty"`
	SenderID  int64   `json:"senderId"`
	Content   string  `json:"content"`
	CreatedAt string  `json:"createdAt"`
	Type      string  `json:"type,omitempty"`
	Url       *string `json:"url,omitempty"`
}

type RecentMessageDto struct {
	MessageID string  `json:"messageId"`
	SenderID  int64   `json:"senderId"`
	Content   string  `json:"content"`
	CreatedAt string  `json:"createdAt"`
	Type      string  `json:"type,omitempty"`
	Url       *string `json:"url,omitempty"`
}

type ConversationDto struct {
	ConversationID      string             `json:"conversationId"`
	Type                string             `json:"type"`
	ConversationType    string             `json:"conversationType,omitempty"`
	CreatedBy           int64              `json:"createdBy"`
	CreatedAt           time.Time          `json:"createdAt"`
	Title               *string            `json:"title,omitempty"`
	LastMessageAt       *time.Time         `json:"lastMessageAt,omitempty"`
	LastMessagePreview  *string            `json:"lastMessagePreview,omitempty"`
	LastMessageSenderID *int64             `json:"lastMessageSenderId,omitempty"`
	MemberIDs           []int64            `json:"memberIds,omitempty"`
	MembersCount        *int               `json:"membersCount,omitempty"`
	LastUsers           []int64            `json:"lastUsers,omitempty"`
	LastMessage         *LastMessageDto    `json:"lastMessage,omitempty"`
	RecentMessages      []RecentMessageDto `json:"recentMessages,omitempty"`
	PeerActivity        *UserActivityDto   `json:"peerActivity,omitempty"`
}

type CreateConversationResponseData struct {
	Conversation ConversationDto `json:"conversation"`
}

type ListConversationsQuery struct {
	Limit  int
	Cursor string
}

type PaginatedResult[T any] struct {
	Items      []T     `json:"items"`
	NextCursor *string `json:"nextCursor,omitempty"`
	HasMore    bool    `json:"hasMore"`
}

func (p PaginatedResult[T]) MarshalJSON() ([]byte, error) {
	items := p.Items
	if items == nil {
		items = make([]T, 0)
	}
	type Alias PaginatedResult[T]
	return json.Marshal(&struct {
		Items []T `json:"items"`
		Alias
	}{
		Items: items,
		Alias: (Alias)(p),
	})
}

type MessageAttachmentDto struct {
	Url      string  `json:"url"`
	Type     string  `json:"type"`
	Duration *float64 `json:"duration,omitempty"`
	FileName *string `json:"fileName,omitempty"`
	FileSize *int64  `json:"fileSize,omitempty"`
	MimeType *string `json:"mimeType,omitempty"`
}

type MessageItemDto struct {
	MessageID       string                `json:"messageId"`
	ConversationID  string                `json:"conversationId"`
	SenderID        int64                 `json:"senderId"`
	Content         string                `json:"content"`
	CreatedAt       string                `json:"createdAt"`
	ClientMessageID *string               `json:"clientMessageId,omitempty"`
	Type            string                `json:"type"`
	Url             *string               `json:"url,omitempty"`
	Duration        *float64              `json:"duration,omitempty"`
	Attachment      *MessageAttachmentDto `json:"attachment,omitempty"`
}

type SendMessageWsDto struct {
	ConversationID  string                `json:"conversationId"`
	ClientMessageID string                `json:"clientMessageId"`
	Content         string                `json:"content"`
	Type            string                `json:"type,omitempty"`
	Url             string                `json:"url,omitempty"`
	Duration        *float64              `json:"duration,omitempty"`
	Attachment      *MessageAttachmentDto `json:"attachment,omitempty"`
	SenderName      string                `json:"senderName,omitempty"`
}

type JoinConversationWsDto struct {
	ConversationID string `json:"conversationId"`
}

type LeaveConversationWsDto struct {
	ConversationID string `json:"conversationId"`
}

type UserActivityDto struct {
	UserID     int64   `json:"userId"`
	IsOnline   bool    `json:"isOnline"`
	LastSeenAt *string `json:"lastSeenAt"`
}

type BatchUserActivityRequestDto struct {
	UserIDs []int64 `json:"userIds"`
}

type BatchUserActivityResponseDto struct {
	Activities []UserActivityDto `json:"activities"`
}

type CreateGroupDto struct {
	Title          string  `json:"title"`
	Bio            *string `json:"bio,omitempty"`
	IsPrivate      bool    `json:"isPrivate"`
	Gender         *string `json:"gender,omitempty"`
	MinimumAge     *int    `json:"minimumAge,omitempty"`
	MaximumAge     *int    `json:"maximumAge,omitempty"`
	SubjectID      *int    `json:"subjectId,omitempty"`
	CityID         *int    `json:"cityId,omitempty"`
	Avatar         *string `json:"avatar,omitempty"`
	ParticipantIds []int64 `json:"participantIds,omitempty"`
}

type UpdateGroupDto struct {
	Title      *string `json:"title,omitempty"`
	Bio        *string `json:"bio,omitempty"`
	IsPrivate  *bool   `json:"isPrivate,omitempty"`
	Gender     *string `json:"gender,omitempty"`
	MinimumAge *int    `json:"minimumAge,omitempty"`
	MaximumAge *int    `json:"maximumAge,omitempty"`
	SubjectID  *int    `json:"subjectId,omitempty"`
	CityID     *int    `json:"cityId,omitempty"`
	Avatar     *string `json:"avatar,omitempty"`
	Active     *bool   `json:"active,omitempty"`
}

type GroupResponseDto struct {
	ConversationID   string    `json:"conversationId"`
	Title            string    `json:"title"`
	Bio              *string   `json:"bio,omitempty"`
	Avatar           *string   `json:"avatar,omitempty"`
	OwnerID          int64     `json:"ownerId"`
	IsPrivate        bool      `json:"isPrivate"`
	Active           bool      `json:"active"`
	MembershipStatus string    `json:"membershipStatus,omitempty"`
	Role             string    `json:"role,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

type GroupUserDto struct {
	UserID int64 `json:"userId"`
}

type BanGroupUserDto struct {
	UserID int64   `json:"userId"`
	Reason *string `json:"reason,omitempty"`
}

type GroupParticipantResponseDto struct {
	UserID    int64     `json:"userId"`
	Status    string    `json:"status"`
	Role      string    `json:"role"`
	JoinedAt  time.Time `json:"joinedAt"`
	BanReason *string   `json:"banReason,omitempty"`
}

type ListGroupParticipantsQuery struct {
	Status string
	Limit  int
	Cursor string
}

type ListGroupParticipantsResponseDto struct {
	Participants []GroupParticipantResponseDto `json:"participants"`
	NextCursor   *string                       `json:"nextCursor,omitempty"`
}

type UploadMediaResponseData struct {
	Url            string   `json:"url"`
	Type           string   `json:"type"`
	Duration       *float64 `json:"duration,omitempty"`
	FileName       string   `json:"fileName"`
	StoredFileName string   `json:"storedFileName"`
	FileSize       int64    `json:"fileSize"`
	Size           int64    `json:"size"`
	MimeType       string   `json:"mimeType"`
}
