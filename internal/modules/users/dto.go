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
	ID      *int              `json:"id"`
	Name    *string           `json:"name"`
	State   *StateResponseDto `json:"State"`
	Country *string           `json:"country,omitempty"`
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
	Answers          map[string]int          `json:"Answers,omitempty"`
	LikedActivities  map[string]interface{}  `json:"LikedActivities,omitempty"`
}

type ProfileResponseDto struct {
	ID               int                      `json:"id"`
	Email            *string                  `json:"email"`
	Language         string                   `json:"language"`
	Lat              *float64                 `json:"lat"`
	Lon              *float64                 `json:"lon"`
	ProfileValidated bool                     `json:"profileValidated"`
	IsPremium        bool                     `json:"isPremium"`
	Profile          ProfileNestedResponseDto `json:"Profile"`
	Gallery          []GalleryItemResponseDto `json:"gallery"`
	ProfilePictureID *int                     `json:"profilePictureId"`
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
	ID         int    `json:"id"`
	DeviceInfo string `json:"deviceInfo"`
	IsCurrent  bool   `json:"isCurrent"`
	CreatedAt  string `json:"createdAt"`
}

type UserDevicesResponseDto struct {
	Devices []UserDeviceItemDto `json:"devices"`
}

type GalleryPayloadDto struct {
	ID               *int    `json:"id,omitempty"`
	IsProfilePicture *bool   `json:"isProfilePicture,omitempty"`
	Description      *string `json:"description,omitempty"`
}

type UpdateProfilePayload struct {
	Language         *string            `json:"language,omitempty"`
	Lat              *float64           `json:"lat,omitempty"`
	Lon              *float64           `json:"lon,omitempty"`
	ProfilePictureID *int               `json:"profilePictureId,omitempty"`
	Gallery          *GalleryPayloadDto `json:"gallery,omitempty"`
	Profile          *struct {
		FullName    *string   `json:"fullName,omitempty"`
		Username    *string   `json:"username,omitempty"`
		PhoneNumber *string   `json:"phoneNumber,omitempty"`
		Bio         *string   `json:"bio,omitempty"`
		Languages   *[]string `json:"languages,omitempty"`
		Demographic *struct {
			BirthDate      *string `json:"birthDate,omitempty"`
			Gender         *string `json:"gender,omitempty"`
			Height         *int    `json:"height,omitempty"`
			Degree         *string `json:"degree,omitempty"`
			Profession     *string `json:"profession,omitempty"`
			RelationStatus *string `json:"relationStatus,omitempty"`
			CityID         *int    `json:"cityId,omitempty"`
			CityName       *string `json:"cityName,omitempty"`
		} `json:"Demographic,omitempty"`
		Preferences *struct {
			Relation *string `json:"relation,omitempty"`
		} `json:"Preferences,omitempty"`
		RelationType *string `json:"relationType,omitempty"`
	} `json:"Profile,omitempty"`
}
