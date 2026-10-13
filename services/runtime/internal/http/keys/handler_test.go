package keys_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/peretyn/peretyn/services/runtime/internal/http/auth"
	"github.com/peretyn/peretyn/services/runtime/internal/http/keys"
	"github.com/peretyn/peretyn/services/runtime/internal/http/keys/keystest"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type testEnv struct {
	t      *testing.T
	mux    http.Handler
	store  *keys.Store
	secret string
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	store := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
	mux := http.NewServeMux()
	keys.Routes(mux, keys.Deps{RequireInternal: auth.RequireInternal("test-secret"), Store: store, Logger: zap.NewNop()})
	return &testEnv{t: t, mux: mux, store: store, secret: "test-secret"}
}

func (e *testEnv) do(method, path string, body []byte) *httptest.ResponseRecorder {
	e.t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("X-Peretyn-Internal-Secret", e.secret)
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	e.mux.ServeHTTP(w, req)
	return w
}

func (e *testEnv) createKey(p keys.CreateReq) string {
	e.t.Helper()
	body, err := json.Marshal(p)
	require.NoError(e.t, err)
	w := e.do("POST", "/v1/internal/keys", body)
	require.Equal(e.t, http.StatusCreated, w.Code, "createKey: unexpected status: %s", w.Body.String())
	var resp map[string]string
	decodeBody(e.t, w, &resp)
	require.NotEmpty(e.t, resp["plaintext"])
	return resp["plaintext"]
}

func decodeBody(t *testing.T, w *httptest.ResponseRecorder, v any) {
	t.Helper()
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), v), "decodeBody: body=%s", w.Body.String())
}

func TestCreateKeyEndpoint(t *testing.T) {
	e := newTestEnv(t)

	tok := e.createKey(keys.CreateReq{
		EnvironmentUUID: uuid.NewString(),
		StoreID:         "key-store",
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})

	t.Run("plaintext token has correct prefix", func(t *testing.T) {
		if len(tok) <= len(testPrefix) {
			t.Errorf("token too short: %q", tok)
		}
		if tok[:len(testPrefix)] != testPrefix {
			t.Errorf("token prefix = %q, want %q", tok[:len(testPrefix)], testPrefix)
		}
	})

	t.Run("created token resolves to the right scope", func(t *testing.T) {
		tc, ok, err := e.store.Lookup(context.Background(), tok)
		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, "key-store", tc.StoreID)
		require.Equal(t, "dev", tc.Environment)
	})

	t.Run("response includes prefix and last4", func(t *testing.T) {
		body, _ := json.Marshal(keys.CreateReq{
			EnvironmentUUID: uuid.NewString(),
			StoreID:         "key-store",
			ProjectSlug:     "proj",
			EnvironmentName: "staging",
		})
		w := e.do("POST", "/v1/internal/keys", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201: %s", w.Code, w.Body.String())
		}
		var resp map[string]string
		decodeBody(t, w, &resp)
		if resp["prefix"] != testPrefix+"test_" {
			t.Errorf("prefix = %q, want %q", resp["prefix"], testPrefix+"test_")
		}
		if len(resp["last4"]) != 4 {
			t.Errorf("last4 = %q, want 4 chars", resp["last4"])
		}
		if resp["plaintext"][len(resp["plaintext"])-4:] != resp["last4"] {
			t.Errorf("last4 %q doesn't match plaintext suffix", resp["last4"])
		}
	})
}

func TestCreateKeyValidation(t *testing.T) {
	e := newTestEnv(t)

	cases := []struct {
		name    string
		payload map[string]string
	}{
		{"missing environmentUuid", map[string]string{"storeId": "s1", "projectSlug": "p", "environmentName": "dev"}},
		{"missing storeId", map[string]string{"environmentUuid": "00000000-0000-0000-0000-000000000001", "projectSlug": "p", "environmentName": "dev"}},
		{"missing projectSlug", map[string]string{"environmentUuid": "00000000-0000-0000-0000-000000000001", "storeId": "s1", "environmentName": "dev"}},
		{"missing environmentName", map[string]string{"environmentUuid": "00000000-0000-0000-0000-000000000001", "storeId": "s1", "projectSlug": "p"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			w := e.do("POST", "/v1/internal/keys", body)
			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400: %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestBodySizeLimitCreateKey(t *testing.T) {
	e := newTestEnv(t)

	prefix := []byte(`{"environmentUuid":"00000000-0000-0000-0000-000000000001","storeId":"s1","projectSlug":"p","environmentName":"dev","extra":`)
	garbage := bytes.Repeat([]byte("x"), 5*1024*1024)
	body := append(prefix, garbage...)

	w := e.do("POST", "/v1/internal/keys", body)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d, want 413: %s", w.Code, w.Body.String())
	}
}

func TestRotateKeyEndpoint(t *testing.T) {
	e := newTestEnv(t)

	envUUID := uuid.NewString()
	oldTok := e.createKey(keys.CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "rotate-store",
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})

	w := e.do("POST", "/v1/internal/keys/"+envUUID+"/rotate", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("rotate: status = %d, want 200: %s", w.Code, w.Body.String())
	}
	var resp map[string]string
	decodeBody(t, w, &resp)
	newTok := resp["plaintext"]
	if newTok == "" {
		t.Fatal("rotate: missing plaintext in response")
	}
	if newTok == oldTok {
		t.Error("rotate: new token should differ from old token")
	}

	ctx := context.Background()
	if _, ok, _ := e.store.Lookup(ctx, oldTok); ok {
		t.Error("old token should be invalid after rotate")
	}
	if _, ok, _ := e.store.Lookup(ctx, newTok); !ok {
		t.Error("new token should be valid after rotate")
	}
}

var errDatabaseDown = errors.New("database unreachable")

type failingRepository struct {
	keys.Repository
}

func (failingRepository) Replace(context.Context, string, func(string) keys.Credential) (string, error) {
	return "", errDatabaseDown
}

func TestRotateKeyReportsDatabaseFailure(t *testing.T) {
	store := keys.NewStore(failingRepository{}, testPrefix)
	mux := http.NewServeMux()
	keys.Routes(mux, keys.Deps{RequireInternal: auth.RequireInternal("test-secret"), Store: store, Logger: zap.NewNop()})
	e := &testEnv{t: t, mux: mux, store: store, secret: "test-secret"}

	w := e.do("POST", "/v1/internal/keys/00000000-0000-0000-0000-000000000001/rotate", nil)
	require.Equal(t, http.StatusInternalServerError, w.Code, w.Body.String())
}

func TestRotateKeyNotFound(t *testing.T) {
	e := newTestEnv(t)
	w := e.do("POST", "/v1/internal/keys/"+uuid.NewString()+"/rotate", nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestDeleteKeyEndpoint(t *testing.T) {
	e := newTestEnv(t)

	envUUID := uuid.NewString()
	tok := e.createKey(keys.CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "delete-store",
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})

	ctx := context.Background()
	if _, ok, _ := e.store.Lookup(ctx, tok); !ok {
		t.Fatal("pre-delete: expected token to be valid")
	}

	w := e.do("DELETE", "/v1/internal/keys/"+envUUID, nil)
	if w.Code != http.StatusNoContent {
		t.Fatalf("delete: status = %d, want 204: %s", w.Code, w.Body.String())
	}

	if _, ok, _ := e.store.Lookup(ctx, tok); ok {
		t.Error("after delete: expected token to be invalid")
	}
}

func TestKeyEndpointsRejectMalformedEnvironmentUUID(t *testing.T) {
	e := newTestEnv(t)
	body, err := json.Marshal(keys.CreateReq{EnvironmentUUID: "env-1", StoreID: "s1", ProjectSlug: "p", EnvironmentName: "dev"})
	require.NoError(t, err)

	for _, tc := range []struct {
		method, path string
		body         []byte
	}{
		{"POST", "/v1/internal/keys", body},
		{"POST", "/v1/internal/keys/env-1/rotate", nil},
		{"DELETE", "/v1/internal/keys/env-1", nil},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			w := e.do(tc.method, tc.path, tc.body)
			require.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
		})
	}
}

func TestCreateKeyTwiceConflicts(t *testing.T) {
	e := newTestEnv(t)
	req := keys.CreateReq{EnvironmentUUID: uuid.NewString(), StoreID: "s1", ProjectSlug: "p", EnvironmentName: "dev"}
	e.createKey(req)

	body, err := json.Marshal(req)
	require.NoError(t, err)
	w := e.do("POST", "/v1/internal/keys", body)
	require.Equal(t, http.StatusConflict, w.Code, w.Body.String())
}
