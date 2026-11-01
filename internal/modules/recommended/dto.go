package recommended

type RecommendedQuery struct {
	Start        *int
	CandidateID  *int
	Limit        *int
	End          *int
	Offset       *int
	AnchorUserID *int
	Before       *int
	After        *int
}

type RecommendedCandidateDto struct {
	ID        int     `json:"id"`
	AvatarUrl *string `json:"avatarUrl"`
	Age       *int    `json:"age"`
	City      *string `json:"city"`
	Username  *string `json:"username"`
	FullName  *string `json:"fullName"`
}

type RankedCandidateItem struct {
	ID                 int     `json:"id"`
	AvatarUrl          *string `json:"avatarUrl"`
	Age                *int    `json:"age"`
	City               *string `json:"city"`
	Username           *string `json:"username"`
	FullName           *string `json:"fullName"`
	CompatibilityScore int     `json:"compatibilityScore"`
	IsSwiped           bool    `json:"isSwiped"`
}
