package interests

type InterestIconResponseDto struct {
	Type string `json:"type"`
	Url  string `json:"url"`
	Alt  string `json:"alt"`
}

type InterestItemResponseDto struct {
	ID         int     `json:"id"`
	En         string  `json:"en"`
	Fa         string  `json:"fa"`
	CategoryID *int    `json:"categoryId,omitempty"`
	Name       *string `json:"name,omitempty"`
	EnName     *string `json:"enName,omitempty"`
	FaName     *string `json:"faName,omitempty"`
}

type InterestCategoryResponseDto struct {
	ID        int                       `json:"id"`
	En        string                    `json:"en"`
	Fa        string                    `json:"fa"`
	Icon      *InterestIconResponseDto  `json:"icon"`
	Interest  []InterestItemResponseDto `json:"Interest"`
	Name      *string                   `json:"name,omitempty"`
	EnName    *string                   `json:"enName,omitempty"`
	FaName    *string                   `json:"faName,omitempty"`
}

type CreateInterestCategoryDto struct {
	NameEn    string `json:"nameEn"`
	NameFa    string `json:"nameFa"`
	Icon      string `json:"icon,omitempty"`
	IconAlt   string `json:"iconAlt,omitempty"`
	Interests []struct {
		NameEn string `json:"nameEn"`
		NameFa string `json:"nameFa"`
	} `json:"interests,omitempty"`
}
