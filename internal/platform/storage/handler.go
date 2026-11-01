package storage

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
)

type AssetHandler struct {
	engine             Engine
	nginxAccelRedirect bool
}

func NewAssetHandler(engine Engine, nginxAccelRedirect bool) *AssetHandler {
	return &AssetHandler{
		engine:             engine,
		nginxAccelRedirect: nginxAccelRedirect,
	}
}

func (h *AssetHandler) ServeAsset(w http.ResponseWriter, r *http.Request, assetType, filename string) {
	cleanType := strings.ToLower(strings.TrimSpace(assetType))
	cleanFile := filepath.Base(filename)

	// If Nginx Accel-Redirect is enabled and local storage is used, offload to Nginx
	if h.nginxAccelRedirect {
		w.Header().Set("X-Accel-Redirect", fmt.Sprintf("/protected_assets/%s/%s", cleanType, cleanFile))
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.WriteHeader(http.StatusOK)
		return
	}

	stored, err := h.engine.Open(r.Context(), cleanType, cleanFile)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", stored.MimeType)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

	if stored.ETag != "" {
		w.Header().Set("ETag", stored.ETag)
		if match := r.Header.Get("If-None-Match"); match != "" && (match == stored.ETag || match == "*") {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}

	http.ServeContent(w, r, cleanFile, stored.LastModified, stored.Content)
}
