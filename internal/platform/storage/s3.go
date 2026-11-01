package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime"
	"path/filepath"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type S3Engine struct {
	client *minio.Client
	bucket string
}

func NewS3Engine(ctx context.Context, endpoint, accessKey, secretKey, bucket string, useSSL bool) (*S3Engine, error) {
	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to init S3/MinIO client: %w", err)
	}

	exists, err := minioClient.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check S3 bucket: %w", err)
	}
	if !exists {
		err = minioClient.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to create S3 bucket %s: %w", bucket, err)
		}
	}

	return &S3Engine{
		client: minioClient,
		bucket: bucket,
	}, nil
}

func (s *S3Engine) objectKey(assetType, filename string) string {
	cleanType := strings.ToLower(strings.TrimSpace(assetType))
	cleanFile := filepath.Base(filename)
	return fmt.Sprintf("%s/%s", cleanType, cleanFile)
}

func (s *S3Engine) Save(ctx context.Context, assetType, filename string, reader io.Reader, size int64, mimeType string) (string, error) {
	key := s.objectKey(assetType, filename)
	_, err := s.client.PutObject(ctx, s.bucket, key, reader, size, minio.PutObjectOptions{
		ContentType: mimeType,
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload object to S3: %w", err)
	}
	return key, nil
}

func (s *S3Engine) Open(ctx context.Context, assetType, filename string) (*StoredFile, error) {
	key := s.objectKey(assetType, filename)
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}

	stat, err := obj.Stat()
	if err != nil {
		_ = obj.Close()
		return nil, err
	}

	data, err := io.ReadAll(obj)
	_ = obj.Close()
	if err != nil {
		return nil, err
	}

	ext := filepath.Ext(filename)
	mimeType := stat.ContentType
	if mimeType == "" {
		mimeType = mime.TypeByExtension(ext)
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	return &StoredFile{
		Content:      bytes.NewReader(data),
		Size:         stat.Size,
		MimeType:     mimeType,
		ETag:         stat.ETag,
		LastModified: stat.LastModified,
	}, nil
}

func (s *S3Engine) Delete(ctx context.Context, assetType, filename string) error {
	key := s.objectKey(assetType, filename)
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}

func (s *S3Engine) Exists(ctx context.Context, assetType, filename string) bool {
	key := s.objectKey(assetType, filename)
	_, err := s.client.StatObject(ctx, s.bucket, key, minio.StatObjectOptions{})
	return err == nil
}
