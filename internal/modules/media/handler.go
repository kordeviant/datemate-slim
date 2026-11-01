package media

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"datemate/internal/common"
	"datemate/internal/config"
	"datemate/internal/platform/storage"

	"github.com/go-chi/chi/v5"
)

type AssetTypeConfig struct {
	AssetType            string   `json:"assetType"`
	AllowedMimeTypes     []string `json:"allowedMimeTypes"`
	AllowedExtensions    []string `json:"allowedExtensions"`
	MaxSizeBytes         int64    `json:"maxSizeBytes"`
	MinSizeBytes         int64    `json:"minSizeBytes,omitempty"`
	MagicBytesValidation bool     `json:"magicBytesValidation"`
	Description          string   `json:"description"`
}

var SupportedAssetTypes = []AssetTypeConfig{
	{
		AssetType:            "icons",
		AllowedMimeTypes:     []string{"image/svg+xml", "image/png", "image/webp", "image/jpeg"},
		AllowedExtensions:    []string{".svg", ".png", ".webp", ".jpg", ".jpeg"},
		MaxSizeBytes:         5 * 1024 * 1024,
		MagicBytesValidation: true,
		Description:          "Vector and raster UI icons and badge assets",
	},
	{
		AssetType:            "images",
		AllowedMimeTypes:     []string{"image/jpeg", "image/png", "image/webp", "image/gif"},
		AllowedExtensions:    []string{".jpg", ".jpeg", ".png", ".webp", ".gif"},
		MaxSizeBytes:         15 * 1024 * 1024,
		MagicBytesValidation: true,
		Description:          "Standard images, event banners, and gallery media",
	},
	{
		AssetType:            "avatars",
		AllowedMimeTypes:     []string{"image/jpeg", "image/png", "image/webp"},
		AllowedExtensions:    []string{".jpg", ".jpeg", ".png", ".webp"},
		MinSizeBytes:         10 * 1024,
		MaxSizeBytes:         10 * 1024 * 1024,
		MagicBytesValidation: true,
		Description:          "User profile photos and avatars",
	},
	{
		AssetType:            "selfies",
		AllowedMimeTypes:     []string{"image/jpeg", "image/png", "image/webp"},
		AllowedExtensions:    []string{".jpg", ".jpeg", ".png", ".webp"},
		MinSizeBytes:         10 * 1024,
		MaxSizeBytes:         15 * 1024 * 1024,
		MagicBytesValidation: true,
		Description:          "User identity verification selfie photos",
	},
	{
		AssetType:            "banners",
		AllowedMimeTypes:     []string{"image/jpeg", "image/png", "image/webp"},
		AllowedExtensions:    []string{".jpg", ".jpeg", ".png", ".webp"},
		MaxSizeBytes:         10 * 1024 * 1024,
		MagicBytesValidation: true,
		Description:          "Wide aspect-ratio headers and banners",
	},
	{
		AssetType:            "audio",
		AllowedMimeTypes:     []string{"audio/mpeg", "audio/ogg", "audio/wav", "audio/webm", "audio/aac"},
		AllowedExtensions:    []string{".mp3", ".ogg", ".wav", ".webm", ".aac", ".m4a"},
		MaxSizeBytes:         20 * 1024 * 1024,
		MagicBytesValidation: false,
		Description:          "Voice messages and audio recordings",
	},
	{
		AssetType:            "documents",
		AllowedMimeTypes:     []string{"application/pdf"},
		AllowedExtensions:    []string{".pdf"},
		MaxSizeBytes:         20 * 1024 * 1024,
		MagicBytesValidation: true,
		Description:          "User verification or compliance documents",
	},
}

type MediaUploadResponseDto struct {
	URL          string `json:"url"`
	FileName     string `json:"fileName"`
	MimeType     string `json:"mimeType"`
	SizeBytes    int64  `json:"sizeBytes"`
	OriginalName string `json:"originalName,omitempty"`
}

type Handler struct {
	cfg          *config.Config
	engine       storage.Engine
	assetHandler *storage.AssetHandler
}

func NewHandler(cfg *config.Config, engine storage.Engine) *Handler {
	return &Handler{
		cfg:          cfg,
		engine:       engine,
		assetHandler: storage.NewAssetHandler(engine, cfg.NginxAccelRedirect),
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	// Types & Uploads
	r.Get("/media/types", h.GetSupportedTypes)
	r.Post("/media/upload/{type}", h.UploadAsset)
	r.Post("/assets/upload/{type}", h.UploadAsset)
	r.Post("/media/upload/icons", func(w http.ResponseWriter, r *http.Request) {
		h.uploadAssetType(w, r, "icons")
	})

	// Generic asset serving
	r.Get("/assets/{type}/{filename}", h.ServeAsset)

	// Specific asset category routes
	r.Get("/assets/icons/{filename}", func(w http.ResponseWriter, r *http.Request) {
		h.assetHandler.ServeAsset(w, r, "icons", chi.URLParam(r, "filename"))
	})
	r.Get("/assets/images/{filename}", func(w http.ResponseWriter, r *http.Request) {
		h.assetHandler.ServeAsset(w, r, "images", chi.URLParam(r, "filename"))
	})
	r.Get("/assets/avatars/{filename}", func(w http.ResponseWriter, r *http.Request) {
		h.assetHandler.ServeAsset(w, r, "avatars", chi.URLParam(r, "filename"))
	})
	r.Get("/assets/selfies/{filename}", func(w http.ResponseWriter, r *http.Request) {
		h.assetHandler.ServeAsset(w, r, "selfies", chi.URLParam(r, "filename"))
	})
	r.Get("/assets/banners/{filename}", func(w http.ResponseWriter, r *http.Request) {
		h.assetHandler.ServeAsset(w, r, "banners", chi.URLParam(r, "filename"))
	})
	r.Get("/assets/audio/{filename}", func(w http.ResponseWriter, r *http.Request) {
		h.assetHandler.ServeAsset(w, r, "audio", chi.URLParam(r, "filename"))
	})
	r.Get("/assets/documents/{filename}", func(w http.ResponseWriter, r *http.Request) {
		h.assetHandler.ServeAsset(w, r, "documents", chi.URLParam(r, "filename"))
	})
}

func (h *Handler) GetSupportedTypes(w http.ResponseWriter, r *http.Request) {
	common.RespondSuccess(w, http.StatusOK, "Supported media types", SupportedAssetTypes)
}

func (h *Handler) ServeAsset(w http.ResponseWriter, r *http.Request) {
	assetType := chi.URLParam(r, "type")
	filename := chi.URLParam(r, "filename")
	h.assetHandler.ServeAsset(w, r, assetType, filename)
}

func (h *Handler) UploadAsset(w http.ResponseWriter, r *http.Request) {
	assetType := chi.URLParam(r, "type")
	h.uploadAssetType(w, r, assetType)
}

func (h *Handler) uploadAssetType(w http.ResponseWriter, r *http.Request, assetType string) {
	assetType = strings.ToLower(strings.TrimSpace(assetType))

	var config *AssetTypeConfig
	for _, t := range SupportedAssetTypes {
		if t.AssetType == assetType {
			config = &t
			break
		}
	}
	if config == nil {
		common.RespondError(w, http.StatusBadRequest, fmt.Sprintf("Unsupported asset type '%s'", assetType), common.ErrBadRequest)
		return
	}

	if err := r.ParseMultipartForm(config.MaxSizeBytes + (1 << 20)); err != nil {
		common.RespondError(w, http.StatusBadRequest, "Failed to parse multipart file", common.ErrBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Missing 'file' field", common.ErrBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, "Failed to read uploaded file", common.ErrBadRequest)
		return
	}

	if int64(len(data)) > config.MaxSizeBytes {
		common.RespondError(w, http.StatusBadRequest, fmt.Sprintf("File size exceeds limit of %d bytes", config.MaxSizeBytes), common.ErrBadRequest)
		return
	}
	if config.MinSizeBytes > 0 && int64(len(data)) < config.MinSizeBytes {
		common.RespondError(w, http.StatusBadRequest, fmt.Sprintf("File size is below minimum of %d bytes", config.MinSizeBytes), common.ErrBadRequest)
		return
	}

	safeName, err := storage.ValidateAssetUpload(assetType, header.Filename, data, config.AllowedMimeTypes, config.MaxSizeBytes)
	if err != nil {
		common.RespondError(w, http.StatusBadRequest, err.Error(), common.ErrBadRequest)
		return
	}

	detectedMime := storage.DetectMimeType(data)
	if detectedMime == "application/octet-stream" {
		ext := strings.ToLower(filepath.Ext(safeName))
		if ext == ".svg" {
			detectedMime = "image/svg+xml"
		}
	}

	relPath, err := h.engine.Save(r.Context(), assetType, safeName, bytes.NewReader(data), int64(len(data)), detectedMime)
	if err != nil {
		common.RespondError(w, http.StatusInternalServerError, "Failed to store asset", common.ErrUnknownError)
		return
	}

	fullURL := fmt.Sprintf("%s/%s", strings.TrimRight(h.cfg.AssetBaseURL, "/"), strings.TrimPrefix(relPath, "/"))

	common.RespondSuccess(w, http.StatusCreated, "Media successfully uploaded", MediaUploadResponseDto{
		URL:          fullURL,
		FileName:     safeName,
		MimeType:     detectedMime,
		SizeBytes:    int64(len(data)),
		OriginalName: header.Filename,
	})
}
