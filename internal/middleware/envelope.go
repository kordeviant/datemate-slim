package middleware

import (
	"bytes"
	"encoding/json"
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

func TransformEnvelope() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := strings.ToLower(r.URL.Path)

			// Bypass routes as configured in NestJS TransformInterceptor
			if strings.Contains(path, "/geo") ||
				strings.Contains(path, "/downloads") ||
				strings.Contains(path, "/static") ||
				strings.Contains(path, "/assets/") ||
				path == "/health" || path == "/v1/health" ||
				path == "/time" || path == "/v1/time" ||
				strings.HasPrefix(path, "/chat") {
				next.ServeHTTP(w, r)
				return
			}

			rec := &responseCaptureWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
				body:           &bytes.Buffer{},
			}

			next.ServeHTTP(rec, r)

			// If status code is already set to error (>= 400), don't wrap as success
			if rec.statusCode >= 400 {
				w.WriteHeader(rec.statusCode)
				_, _ = w.Write(rec.body.Bytes())
				return
			}

			capturedBytes := rec.body.Bytes()

			// Check if already enveloped
			var probe map[string]interface{}
			if err := json.Unmarshal(capturedBytes, &probe); err == nil {
				if _, hasStatus := probe["status"]; hasStatus {
					if _, hasMessage := probe["message"]; hasMessage {
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
