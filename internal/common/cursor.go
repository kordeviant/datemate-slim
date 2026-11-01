package common

import (
	"encoding/base64"
	"encoding/json"
	"errors"
)

type PageCursorData struct {
	Bucket      string `json:"bucket,omitempty"`
	PagingState string `json:"pagingState,omitempty"`
	Offset      int    `json:"offset,omitempty"`
	MinBucket   string `json:"minBucket,omitempty"`
	T           int64  `json:"t,omitempty"`
	Shard       int    `json:"shard,omitempty"`
}

func EncodeCursor(data PageCursorData) (string, error) {
	bytes, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func DecodeCursor(cursor string) (*PageCursorData, error) {
	if cursor == "" {
		return nil, errors.New("Invalid opaque cursor")
	}
	bytes, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		// Try standard URLEncoding if padded
		bytes, err = base64.URLEncoding.DecodeString(cursor)
		if err != nil {
			return nil, errors.New("Invalid opaque cursor")
		}
	}
	var data PageCursorData
	if err := json.Unmarshal(bytes, &data); err != nil {
		return nil, errors.New("Invalid opaque cursor")
	}
	return &data, nil
}
