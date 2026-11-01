package storage

import (
	"context"
	"io"
	"time"
)

type StoredFile struct {
	Content      io.ReadSeeker
	Size         int64
	MimeType     string
	ETag         string
	LastModified time.Time
	LocalPath    string
}

type Engine interface {
	Save(ctx context.Context, assetType, filename string, reader io.Reader, size int64, mimeType string) (string, error)
	Open(ctx context.Context, assetType, filename string) (*StoredFile, error)
	Delete(ctx context.Context, assetType, filename string) error
	Exists(ctx context.Context, assetType, filename string) bool
}
