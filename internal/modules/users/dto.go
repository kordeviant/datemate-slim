package users

type CountryResponseDto struct {
	ID     *int    `json:"id"`
	Name   *string `json:"name"`
	Native *string `json:"native,omitempty"`
	Emoji  *string `json:"emoji,omitempty"`
	Code   *string `json:"code,omitempty"`
}

type StateResponseDto struct {
	ID        *int                `json:"id"`
	Name      *string             `json:"name"`
	CountryID *int                `json:"countryId,omitempty"`
	Country   *CountryResponseDto `json:"Country"`
}

type CityResponseDto struct {
	ID       *int              `json:"id,omitempty"`
	Name     *string           `json:"name,omitempty"`
	State    *string           `json:"state,omitempty"`
	Country  *string           `json:"country,omitempty"`
	StateObj *StateResponseDto `json:"State,omitempty"`
}

type DemographicResponseDto struct {
	BirthDate      *string          `json:"birthDate"`
	Gender         *string          `json:"gender"`
	Height         *int             `json:"height"`
	Degree         *string          `json:"degree"`
	Profession     *string          `json:"profession"`
	RelationStatus *string          `json:"relationStatus"`
	City           *CityResponseDto `json:"City"`
}

type PreferencesResponseDto struct {
	Relation *string `json:"relation"`
}

type GalleryItemResponseDto struct {
	ID               int     `json:"id"`
	URL              string  `json:"url"`
	Description      *string `json:"description"`
	IsProfilePicture bool    `json:"isProfilePicture"`
	CreatedAt        *string `json:"createdAt,omitempty"`
}

type ProfileNestedResponseDto struct {
	FullName         *string                 `json:"fullName"`
	Username         *string                 `json:"username"`
	PhoneNumber      *string                 `json:"phoneNumber"`
	Bio              *string                 `json:"bio"`
	Languages        []string                `json:"languages"`
	Avatar           string                  `json:"avatar"`
	ProfilePicture   *string                 `json:"profilePicture"`
	ProfilePictureID *int                    `json:"profilePictureId"`
	ProfileCompleted bool                    `json:"profileCompleted"`
	IsPremium        bool                    `json:"isPremium"`
	Demographic      *DemographicResponseDto `json:"Demographic"`
	RelationType     *string                 `json:"RelationType"`
	Preferences      *PreferencesResponseDto `json:"Preferences,omitempty"`
	Answers          map[string]interface{}  `json:"Answers,omitempty"`
	LikedActivities  map[string]interface{}  `json:"LikedActivities,omitempty"`
}

type ProfileResponseDto struct {
	ID               int                      `json:"id"`
	Email            *string                  `json:"email"`
	Language         string                   `json:"language"`
	Lat              *float64                 `json:"lat"`
	Lon              *float64                 `json:"lon"`
	ProfileValidated  bool                     `json:"profileValidated"`
	IsPremium         bool                     `json:"isPremium"`
	PrivacyAcceptedAt *string                  `json:"privacyAcceptedAt"`
	Profile           ProfileNestedResponseDto `json:"Profile"`
	Gallery           []GalleryItemResponseDto `json:"gallery"`
	ProfilePictureID  *int                     `json:"profilePictureId"`
}

type AcceptPrivacyRequestDto struct {
	Accepted *bool `json:"accepted,omitempty"`
}

type AcceptPrivacyResponseDto struct {
	PrivacyAcceptedAt string `json:"privacyAcceptedAt"`
	ProfileCompleted  bool   `json:"profileCompleted"`
}

type BulkUserItemDto struct {
	ID       int     `json:"id"`
	Avatar   string  `json:"avatar"`
	Username *string `json:"username"`
	FullName *string `json:"fullName"`
}

type UserAvatarDto struct {
	UserID int    `json:"userId"`
	Avatar string `json:"avatar"`
}

type DeviceTokenDto struct {
	Token      string  `json:"token"`
	DeviceInfo *string `json:"deviceInfo,omitempty"`
}

type UserDeviceItemDto struct {
	ID         int     `json:"id"`
	DeviceInfo *string `json:"deviceInfo"`
	FcmToken   *string `json:"fcmToken,omitempty"`
	IsActive   bool    `json:"isActive"`
	IsCurrent  bool    `json:"isCurrent"`
	CreatedAt  string  `json:"createdAt"`
	ExpiresAt  *string `json:"expiresAt,omitempty"`
}

type UserDevicesResponseDto struct {
	Devices         []UserDeviceItemDto `json:"devices"`
	ActiveDevices   []UserDeviceItemDto `json:"activeDevices"`
	InactiveDevices []UserDeviceItemDto `json:"inactiveDevices"`
	Total           int                 `json:"total"`
	ActiveCount     int                 `json:"activeCount"`
	InactiveCount   int                 `json:"inactiveCount"`
}

type GalleryPayloadDto struct {
	ID               *int    `json:"id,omitempty"`
	IsProfilePicture *bool   `json:"isProfilePicture,omitempty"`
	Description      *string `json:"description,omitempty"`
}

type UpdateDemographicPayload struct {
	BirthDate      *string `json:"birthDate,omitempty"`
	Gender         *string `json:"gender,omitempty"`
	Height         *int    `json:"height,omitempty"`
	Degree         *string `json:"degree,omitempty"`
	Profession     *string `json:"profession,omitempty"`
	RelationStatus *string `json:"relationStatus,omitempty"`
	CityID         *int    `json:"cityId,omitempty"`
	City           *struct {
		ID *int `json:"id,omitempty"`
	} `json:"City,omitempty"`
	CityName       *string `json:"cityName,omitempty"`
}

type UpdatePreferencesPayload struct {
	Relation *string `json:"relation,omitempty"`
}

type UpdateProfileNestedDto struct {
	FullName               *string                   `json:"fullName,omitempty"`
	Username               *string                   `json:"username,omitempty"`
	PhoneNumber            *string                   `json:"phoneNumber,omitempty"`
	Bio                    *string                   `json:"bio,omitempty"`
	Languages              *[]string                 `json:"languages,omitempty"`
	Avatar                 *string                   `json:"avatar,omitempty"`
	AvatarUrl              *string                   `json:"avatarUrl,omitempty"`
	Demographic            *UpdateDemographicPayload `json:"Demographic,omitempty"`
	DemographicLower       *UpdateDemographicPayload `json:"demographic,omitempty"`
	Preferences            *UpdatePreferencesPayload `json:"Preferences,omitempty"`
	PreferencesLower       *UpdatePreferencesPayload `json:"preferences,omitempty"`
	RelationType           *string                   `json:"relationType,omitempty"`
	Answers                interface{}               `json:"answers,omitempty"`
	AnswersCapital         interface{}               `json:"Answers,omitempty"`
	Questions              interface{}               `json:"questions,omitempty"`
	QuestionsCapital       interface{}               `json:"Questions,omitempty"`
	QuestionAnswers        interface{}               `json:"questionAnswers,omitempty"`
	LikedActivities        interface{}               `json:"likedActivities,omitempty"`
	LikedActivitiesCapital interface{}               `json:"LikedActivities,omitempty"`
	Interests              interface{}               `json:"interests,omitempty"`
	InterestsCapital       interface{}               `json:"Interests,omitempty"`
	Interest               interface{}               `json:"interest,omitempty"`
	Favorites              interface{}               `json:"favorites,omitempty"`
	FavoritesCapital       interface{}               `json:"Favorites,omitempty"`
}

type UpdateProfilePayload struct {
	Language               *string                 `json:"language,omitempty"`
	Lat                    *float64                `json:"lat,omitempty"`
	Lon                    *float64                `json:"lon,omitempty"`
	Avatar                 *string                 `json:"avatar,omitempty"`
	AvatarUrl              *string                 `json:"avatarUrl,omitempty"`
	ProfilePictureID       *int                    `json:"profilePictureId,omitempty"`
	PrivacyAccepted        *bool                   `json:"privacyAccepted,omitempty"`
	Gallery                *GalleryPayloadDto      `json:"gallery,omitempty"`
	Answers                interface{}             `json:"answers,omitempty"`
	AnswersCapital         interface{}             `json:"Answers,omitempty"`
	Questions              interface{}             `json:"questions,omitempty"`
	QuestionsCapital       interface{}             `json:"Questions,omitempty"`
	QuestionAnswers        interface{}             `json:"questionAnswers,omitempty"`
	LikedActivities        interface{}             `json:"likedActivities,omitempty"`
	LikedActivitiesCapital interface{}             `json:"LikedActivities,omitempty"`
	Interests              interface{}             `json:"interests,omitempty"`
	InterestsCapital       interface{}             `json:"Interests,omitempty"`
	Interest               interface{}             `json:"interest,omitempty"`
	Favorites              interface{}             `json:"favorites,omitempty"`
	FavoritesCapital       interface{}             `json:"Favorites,omitempty"`
	Profile                *UpdateProfileNestedDto `json:"Profile,omitempty"`
	ProfileLower           *UpdateProfileNestedDto `json:"profile,omitempty"`
}
