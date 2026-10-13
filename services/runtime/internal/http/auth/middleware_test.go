package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type fakeKeyLookup struct {
	tokens map[string]TokenContext
	err    error
}

func (f fakeKeyLookup) Lookup(_ context.Context, token string) (TokenContext, bool, error) {
	tc, ok := f.tokens[token]
	return tc, ok, f.err
}

func TestRequireToken(t *testing.T) {
	keys := fakeKeyLookup{tokens: map[string]TokenContext{
		"good-token": {StoreID: "store-1", Environment: "dev"},
	}}
	mux := http.NewServeMux()
	Routes(mux, RequireToken(zap.NewNop(), keys))

	tests := []struct {
		name   string
		header string
		want   int
	}{
		{"no header", "", http.StatusUnauthorized},
		{"wrong token", "Bearer bad-token", http.StatusUnauthorized},
		{"correct token", "Bearer good-token", http.StatusOK},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/v1/me", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Errorf("status = %d, want %d (body: %s)", w.Code, tc.want, w.Body.String())
			}
		})
	}

	t.Run("token with empty StoreID is forbidden", func(t *testing.T) {
		keys2 := fakeKeyLookup{tokens: map[string]TokenContext{
			"no-store-token": {StoreID: "", Environment: "dev"},
		}}
		mux2 := http.NewServeMux()
		Routes(mux2, RequireToken(zap.NewNop(), keys2))
		req := httptest.NewRequest("GET", "/v1/me", nil)
		req.Header.Set("Authorization", "Bearer no-store-token")
		w := httptest.NewRecorder()
		mux2.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("status = %d, want %d", w.Code, http.StatusForbidden)
		}
	})
}

func TestRequireTokenHidesLookupFailure(t *testing.T) {
	mux := http.NewServeMux()
	Routes(mux, RequireToken(zap.NewNop(), fakeKeyLookup{err: errors.New("lookup api_key: dial tcp 10.0.0.5:5432: connection refused")}))

	req := httptest.NewRequest("GET", "/v1/me", nil)
	req.Header.Set("Authorization", "Bearer some-token")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	require.Equal(t, http.StatusServiceUnavailable, w.Code)
	require.JSONEq(t, `{"error":"Service Unavailable","code":503}`, w.Body.String())
}

func TestRequireInternal(t *testing.T) {
	newMux := func(secret string) http.Handler {
		mux := http.NewServeMux()
		mux.HandleFunc("GET /v1/stores", RequireInternal(secret)(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		return mux
	}

	mux := newMux("test-secret")
	tests := []struct {
		name   string
		header string
		want   int
	}{
		{"no header", "", http.StatusUnauthorized},
		{"wrong secret", "wrong-secret", http.StatusUnauthorized},
		{"correct secret", "test-secret", http.StatusOK},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/v1/stores", nil)
			if tc.header != "" {
				req.Header.Set("X-Peretyn-Internal-Secret", tc.header)
			}
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Errorf("status = %d, want %d (body: %s)", w.Code, tc.want, w.Body.String())
			}
		})
	}

	t.Run("empty configured secret always 401", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/v1/stores", nil)
		req.Header.Set("X-Peretyn-Internal-Secret", "")
		w := httptest.NewRecorder()
		newMux("").ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})
}

func TestCrossSurfaceAuth(t *testing.T) {
	const secret = "test-secret"
	keys := fakeKeyLookup{tokens: map[string]TokenContext{
		"good-token": {StoreID: "store-1"},
	}}

	tokenMux := http.NewServeMux()
	Routes(tokenMux, RequireToken(zap.NewNop(), keys))

	internalMux := http.NewServeMux()
	internalMux.HandleFunc("POST /v1/stores", RequireInternal(secret)(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))

	t.Run("internal secret used as bearer is rejected", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/v1/me", nil)
		req.Header.Set("Authorization", "Bearer "+secret)
		w := httptest.NewRecorder()
		tokenMux.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})

	t.Run("bearer token on internal endpoint is rejected", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/v1/stores", nil)
		req.Header.Set("Authorization", "Bearer good-token")
		w := httptest.NewRecorder()
		internalMux.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
		}
	})
}
