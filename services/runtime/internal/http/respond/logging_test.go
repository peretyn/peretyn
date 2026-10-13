package respond

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"go.uber.org/zap"
)

func TestLoggingMiddleware(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ok", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := Logging(zap.NewNop(), mux)

	t.Run("with X-Request-Id returns 200", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/ok", nil)
		req.Header.Set("X-Request-Id", "test-req-id")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want 200", w.Code)
		}
	})

	t.Run("without X-Request-Id returns 200", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/ok", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("status = %d, want 200", w.Code)
		}
	})

	t.Run("X-Request-Id not echoed in response headers", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/ok", nil)
		req.Header.Set("X-Request-Id", "my-req-id")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if got := w.Header().Get("X-Request-Id"); got != "" {
			t.Errorf("X-Request-Id in response = %q, want empty", got)
		}
	})

	t.Run("404 handler returns 404", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/no-such-path", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != http.StatusNotFound {
			t.Errorf("status = %d, want 404", w.Code)
		}
	})
}
