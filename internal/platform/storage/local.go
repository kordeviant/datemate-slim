package storage

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

type LocalEngine struct {
	baseDir string
}

func NewLocalEngine(baseDir string) (*LocalEngine, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base uploads dir: %w", err)
	}

	subdirs := []string{"icons", "images", "avatars", "selfies", "banners", "audio", "documents", "chat"}
	for _, sub := range subdirs {
		_ = os.MkdirAll(filepath.Join(baseDir, sub), 0755)
	}

	return &LocalEngine{baseDir: baseDir}, nil
}

func (l *LocalEngine) resolvePath(assetType, filename string) string {
	cleanType := strings.ToLower(strings.TrimSpace(assetType))
	cleanFile := filepath.Base(filename)

	directPath := filepath.Join(l.baseDir, cleanType, cleanFile)
	if _, err := os.Stat(directPath); err == nil {
		return directPath
	}

	if unescaped, err := url.PathUnescape(cleanFile); err == nil && unescaped != cleanFile {
		unPath := filepath.Join(l.baseDir, cleanType, unescaped)
		if _, err := os.Stat(unPath); err == nil {
			return unPath
		}
	}

	if unescaped, err := url.QueryUnescape(cleanFile); err == nil && unescaped != cleanFile {
		unPath := filepath.Join(l.baseDir, cleanType, unescaped)
		if _, err := os.Stat(unPath); err == nil {
			return unPath
		}
	}

	return directPath
}

func (l *LocalEngine) Save(ctx context.Context, assetType, filename string, reader io.Reader, size int64, mimeType string) (string, error) {
	destPath := l.resolvePath(assetType, filename)
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return "", err
	}

	out, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("unable to create file %s: %w", destPath, err)
	}
	defer out.Close()

	if _, err := io.Copy(out, reader); err != nil {
		return "", fmt.Errorf("unable to write content: %w", err)
	}

	return destPath, nil
}

func (l *LocalEngine) Open(ctx context.Context, assetType, filename string) (*StoredFile, error) {
	filePath := l.resolvePath(assetType, filename)
	f, err := os.Open(filePath)
	if err != nil && assetType != "" {
		// Fallback to checking root baseDir
		fallbackPath := filepath.Join(l.baseDir, filepath.Base(filename))
		if f2, err2 := os.Open(fallbackPath); err2 == nil {
			f = f2
			filePath = fallbackPath
			err = nil
		}
	}
	if err != nil {
		return nil, os.ErrNotExist
	}

	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}

	etag := fmt.Sprintf(`W/"%d-%d"`, info.Size(), info.ModTime().Unix())
	ext := filepath.Ext(filename)
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		switch strings.ToLower(ext) {
		case ".ogg":
			mimeType = "audio/ogg"
		case ".m4a":
			mimeType = "audio/mp4"
		case ".mp3":
			mimeType = "audio/mpeg"
		case ".aac":
			mimeType = "audio/aac"
		case ".wav":
			mimeType = "audio/wav"
		case ".opus":
			mimeType = "audio/opus"
		case ".webm":
			mimeType = "video/webm"
		case ".mp4":
			mimeType = "video/mp4"
		case ".mov":
			mimeType = "video/quicktime"
		case ".jpg", ".jpeg":
			mimeType = "image/jpeg"
		case ".png":
			mimeType = "image/png"
		case ".webp":
			mimeType = "image/webp"
		case ".gif":
			mimeType = "image/gif"
		default:
			mimeType = "application/octet-stream"
		}
	}

	return &StoredFile{
		Content:      f,
		Size:         info.Size(),
		MimeType:     mimeType,
		ETag:         etag,
		LastModified: info.ModTime(),
		LocalPath:    filePath,
	}, nil
}

func (l *LocalEngine) Delete(ctx context.Context, assetType, filename string) error {
	filePath := l.resolvePath(assetType, filename)
	return os.Remove(filePath)
}

func (l *LocalEngine) Exists(ctx context.Context, assetType, filename string) bool {
	filePath := l.resolvePath(assetType, filename)
	info, err := os.Stat(filePath)
	return err == nil && !info.IsDir()
}
