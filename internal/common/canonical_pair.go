package common

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
)

var DirectConversationUUIDNamespace = uuid.MustParse("e57b98d2-1c09-4bf4-9132-7fcfb09ce13b")

func CreatePairKey(userA, userB int64) (string, error) {
	if userA == userB {
		return "", errors.New("self-conversation is not allowed")
	}
	min := userA
	max := userB
	if min > max {
		min, max = userB, userA
	}
	return fmt.Sprintf("%d:%d", min, max), nil
}

func GenerateDeterministicConversationID(pairKey string) uuid.UUID {
	return uuid.NewSHA1(DirectConversationUUIDNamespace, []byte(pairKey))
}
