package middleware

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"

	"datemate/internal/common"
)

type responseCaptureWriter struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func (w *responseCaptureWriter) WriteHeader(code int) {
	w.statusCode = code
}

func (w *responseCaptureWriter) Write(b []byte) (int, error) {
	return w.body.Write(b)
}

func (w *responseCaptureWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hj, ok := w.ResponseWriter.(http.Hijacker); ok {
		return hj.Hijack()
	}
	return nil, nil, fmt.Errorf("underlying ResponseWriter does not implement http.Hijacker")
}

func (w *responseCaptureWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func TransformEnvelope() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := strings.ToLower(r.URL.Path)

			// Bypass routes as configured in NestJS TransformInterceptor
			if strings.Contains(path, "/geo") ||
				strings.Contains(path, "/downloads") ||
				strings.Contains(path, "/static") ||
				strings.Contains(path, "/assets/") ||
				strings.Contains(path, "/uploads/") ||
				strings.Contains(path, "/docs-yaml") ||
				strings.Contains(path, "/docs/yaml") ||
				strings.Contains(path, "/asyncapi") ||
				strings.Contains(path, "/rules") ||
				path == "/" ||
				path == "/health" || path == "/v1/health" ||
				path == "/time" || path == "/v1/time" ||
				strings.HasPrefix(path, "/chat") ||
				strings.HasPrefix(path, "/socket.io") {
				next.ServeHTTP(w, r)
				return
			}

			rec := &responseCaptureWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
				body:           &bytes.Buffer{},
			}

			next.ServeHTTP(rec, r)

			// If Content-Type is non-JSON (YAML, HTML, Markdown, binary), pass through directly
			ct := strings.ToLower(rec.Header().Get("Content-Type"))
			if strings.Contains(ct, "text/yaml") ||
				strings.Contains(ct, "text/html") ||
				strings.Contains(ct, "text/markdown") ||
				strings.Contains(ct, "application/pdf") ||
				strings.HasPrefix(ct, "image/") ||
				strings.HasPrefix(ct, "video/") ||
				strings.HasPrefix(ct, "audio/") {
				for k, v := range rec.Header() {
					w.Header()[k] = v
				}
				w.WriteHeader(rec.statusCode)
				_, _ = w.Write(rec.body.Bytes())
				return
			}

			// If status code is already set to error (>= 400), don't wrap as success
			if rec.statusCode >= 400 {
				capturedBytes := rec.body.Bytes()
				var probe map[string]interface{}
				if err := json.Unmarshal(capturedBytes, &probe); err == nil {
					if _, hasStatus := probe["status"]; hasStatus {
						if _, hasSuccess := probe["success"]; !hasSuccess {
							probe["success"] = false
							if marshaled, mErr := json.Marshal(probe); mErr == nil {
								capturedBytes = marshaled
							}
						}
					}
				}
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(rec.statusCode)
				_, _ = w.Write(capturedBytes)
				return
			}

			capturedBytes := rec.body.Bytes()

			// Check if already enveloped
			var probe map[string]interface{}
			if err := json.Unmarshal(capturedBytes, &probe); err == nil {
				if _, hasStatus := probe["status"]; hasStatus {
					if _, hasMessage := probe["message"]; hasMessage {
						if _, hasSuccess := probe["success"]; !hasSuccess {
							probe["success"] = probe["status"] == common.StatusSuccess
							if marshaled, mErr := json.Marshal(probe); mErr == nil {
								capturedBytes = marshaled
							}
						}
						w.Header().Set("Content-Type", "application/json; charset=utf-8")
						w.WriteHeader(rec.statusCode)
						_, _ = w.Write(capturedBytes)
						return
					}
				}
			}

			// Wrap in ResponseResult
			var data interface{}
			if len(capturedBytes) > 0 {
				if err := json.Unmarshal(capturedBytes, &data); err != nil {
					data = string(capturedBytes)
				}
			}

			envelope := common.ResponseResult[interface{}]{
				Success: true,
				Status:  common.StatusSuccess,
				Message: "Operation successful",
				Data:    data,
				Error:   nil,
			}

			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(rec.statusCode)
			_ = json.NewEncoder(w).Encode(envelope)
		})
	}
}
