package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPublicListenerHasNoInternalRoutes(t *testing.T) {
	e := newTestEnv(t)

	internalRoutes := []struct{ method, path string }{
		{"POST", "/v1/stores"},
		{"DELETE", "/v1/stores/some-id"},
		{"POST", "/v1/stores/some-id/authorization-models"},
		{"POST", "/v1/internal/keys"},
		{"POST", "/v1/internal/keys/some-env/rotate"},
		{"DELETE", "/v1/internal/keys/some-env"},
		{"POST", "/v1/internal/stores/some-id/check"},
		{"POST", "/v1/internal/stores/some-id/read"},
		{"POST", "/v1/internal/stores/some-id/write"},
		{"POST", "/v1/internal/stores/some-id/expand"},
	}

	for _, r := range internalRoutes {
		t.Run(r.method+" "+r.path, func(t *testing.T) {
			req := httptest.NewRequest(r.method, r.path, nil)
			req.Header.Set("X-Peretyn-Internal-Secret", e.secret)
			w := httptest.NewRecorder()
			e.handler.ServeHTTP(w, req)

			require.Equal(t, http.StatusNotFound, w.Code,
				"%s %s is reachable on the public listener; register it in NewInternalHandler",
				r.method, r.path)
		})
	}
}

func TestInternalListenerHasNoPublicRoutes(t *testing.T) {
	e := newTestEnv(t)

	for _, r := range []struct{ method, path string }{
		{"POST", "/v1/check"},
		{"POST", "/v1/batch-check"},
		{"POST", "/v1/write"},
		{"POST", "/v1/expand"},
		{"POST", "/v1/list-objects"},
		{"POST", "/v1/list-users"},
		{"GET", "/v1/changes"},
	} {
		t.Run(r.method+" "+r.path, func(t *testing.T) {
			w := e.doRawInternal(r.method+" "+r.path, map[string]string{
				"X-Peretyn-Internal-Secret": e.secret,
			}, nil)

			require.Equal(t, http.StatusNotFound, w.Code,
				"%s %s is reachable on the internal listener", r.method, r.path)
		})
	}
}

func TestMeIsServedOnBothListeners(t *testing.T) {
	e := newTestEnv(t)
	storeID := e.provisionStore("both-listeners-store")
	token := e.createKey(createKeyPayload{
		StoreID:         storeID,
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})

	w := e.do(token, "GET /v1/me", nil)
	require.Equal(t, http.StatusOK, w.Code, "public: %s", w.Body.String())

	w = e.doRawInternal("GET /v1/me", map[string]string{
		"Authorization": "Bearer " + token,
	}, nil)
	require.Equal(t, http.StatusOK, w.Code, "internal: %s", w.Body.String())

	w = e.doRawInternal("GET /v1/me", map[string]string{
		"X-Peretyn-Internal-Secret": e.secret,
	}, nil)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}
