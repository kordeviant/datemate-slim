package system

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"datemate/internal/common"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	docsDir string
}

func NewHandler(docsDir string) *Handler {
	return &Handler{docsDir: docsDir}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.HealthCheck)
	r.Get("/health", h.HealthCheck)
	r.Get("/time", h.GetServerTime)

	r.Get("/rules", h.GetRules)
	r.Get("/docs/rules", h.GetRules)

	r.Get("/docs/asyncapi-json", h.GetAsyncAPI)
	r.Get("/asyncapi-json", h.GetAsyncAPI)
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func (h *Handler) GetServerTime(w http.ResponseWriter, r *http.Request) {
	nowMs := time.Now().UnixMilli()
	common.RespondSuccess(w, http.StatusOK, "Operation successful", nowMs)
}

func (h *Handler) GetRules(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	download := r.URL.Query().Get("download")

	rulesPath := filepath.Join(h.docsDir, "RULES.md")
	content, err := os.ReadFile(rulesPath)
	if err != nil {
		// Fallback
		content = []byte("# DateMate Platform Rules\nAuthoritative rules specification.")
	}

	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")

	if download == "1" || download == "true" {
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="DateMate-RULES.md"`)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(content)
		return
	}

	if format == "raw" || format == "md" || strings.Contains(r.Header.Get("Accept"), "text/markdown") {
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(content)
		return
	}

	if format == "json" || (strings.Contains(r.Header.Get("Accept"), "application/json") && !strings.Contains(r.Header.Get("Accept"), "text/html")) {
		common.RespondSuccess(w, http.StatusOK, "Operation successful", map[string]interface{}{
			"raw": string(content),
		})
		return
	}

	// HTML View
	html := `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>DateMate Platform Rules</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem; color: #333; background: #fafafa; }
    pre { background: #2d3748; color: #f7fafc; padding: 1rem; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
    h1, h2, h3 { color: #1a202c; }
    a { color: #3182ce; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>DateMate Platform Rules Specification</h1>
  <p><a href="/docs/rules?download=1">📥 Download DateMate-RULES.md</a> | <a href="/docs/rules?format=raw">View Raw Markdown</a> | <a href="/docs/rules?format=json">JSON Format</a></p>
  <pre>` + string(content) + `</pre>
</body>
</html>`

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(html))
}

func (h *Handler) GetAsyncAPI(w http.ResponseWriter, r *http.Request) {
	asyncPath := filepath.Join(h.docsDir, "asyncapi.json")
	content, err := os.ReadFile(asyncPath)
	if err != nil {
		content = []byte(`{"asyncapi": "2.6.0", "info": {"title": "DateMate Chat API"}}`)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
}
