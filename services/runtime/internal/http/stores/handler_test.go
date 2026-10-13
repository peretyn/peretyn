package stores

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/server"
	"github.com/peretyn/peretyn/services/runtime/internal/fga/fgatest"
	"github.com/peretyn/peretyn/services/runtime/internal/http/auth"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"google.golang.org/protobuf/encoding/protojson"
)

type testEnv struct {
	t      *testing.T
	mux    http.Handler
	fga    *server.Server
	secret string
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	fgaServer := fgatest.NewServer(t)

	mux := http.NewServeMux()
	Routes(mux, Deps{RequireInternal: auth.RequireInternal("test-secret"), FGA: fgaServer, Logger: zap.NewNop()})
	return &testEnv{t: t, mux: mux, fga: fgaServer, secret: "test-secret"}
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

func (e *testEnv) provisionStore(name string) string {
	e.t.Helper()
	body, err := json.Marshal(map[string]string{"name": name})
	require.NoError(e.t, err)
	w := e.do("POST", "/v1/stores", body)
	require.Equal(e.t, http.StatusCreated, w.Code, "provisionStore: unexpected status: %s", w.Body.String())
	var resp map[string]any
	decodeBody(e.t, w, &resp)
	id, ok := resp["id"].(string)
	require.True(e.t, ok && id != "", "provisionStore: missing id in response")
	return id
}

func (e *testEnv) writeModel(storeID string) string {
	e.t.Helper()
	req := testModel()
	req.StoreId = storeID
	body, err := protojson.Marshal(req)
	require.NoError(e.t, err)
	w := e.do("POST", "/v1/stores/"+storeID+"/authorization-models", body)
	require.Equal(e.t, http.StatusCreated, w.Code, "writeModel: unexpected status: %s", w.Body.String())
	var resp map[string]any
	decodeBody(e.t, w, &resp)
	modelID, ok := resp["authorization_model_id"].(string)
	require.True(e.t, ok && modelID != "", "writeModel: missing authorization_model_id in response")
	return modelID
}

func decodeBody(t *testing.T, w *httptest.ResponseRecorder, v any) {
	t.Helper()
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), v), "decodeBody: body=%s", w.Body.String())
}

func testModel() *openfgav1.WriteAuthorizationModelRequest {
	return &openfgav1.WriteAuthorizationModelRequest{
		SchemaVersion: "1.1",
		TypeDefinitions: []*openfgav1.TypeDefinition{
			{Type: "user"},
			{
				Type: "document",
				Relations: map[string]*openfgav1.Userset{
					"viewer": {Userset: &openfgav1.Userset_This{This: &openfgav1.DirectUserset{}}},
					"editor": {Userset: &openfgav1.Userset_This{This: &openfgav1.DirectUserset{}}},
				},
				Metadata: &openfgav1.Metadata{
					Relations: map[string]*openfgav1.RelationMetadata{
						"viewer": {DirectlyRelatedUserTypes: []*openfgav1.RelationReference{{Type: "user"}}},
						"editor": {DirectlyRelatedUserTypes: []*openfgav1.RelationReference{{Type: "user"}}},
					},
				},
			},
		},
	}
}

func TestCreateStore(t *testing.T) {
	e := newTestEnv(t)
	body, err := json.Marshal(map[string]string{"name": "test"})
	if err != nil {
		t.Fatal(err)
	}
	w := e.do("POST", "/v1/stores", body)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	decodeBody(t, w, &resp)
	id, _ := resp["id"].(string)
	if id == "" {
		t.Errorf("expected non-empty id in response, got %v", resp)
	}
}

func TestDeleteStore(t *testing.T) {
	e := newTestEnv(t)
	id := e.provisionStore("delete-me")

	w := e.do("DELETE", "/v1/stores/"+id, nil)
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204: %s", w.Code, w.Body.String())
	}

	_, err := e.fga.GetStore(context.Background(), &openfgav1.GetStoreRequest{StoreId: id})
	require.Error(t, err, "the store must be gone after delete")
}

func TestWriteAuthModel(t *testing.T) {
	e := newTestEnv(t)
	storeID := e.provisionStore("auth-model-store")

	t.Run("write model returns 201 with modelId", func(t *testing.T) {
		modelID := e.writeModel(storeID)
		if modelID == "" {
			t.Error("expected non-empty modelId")
		}
	})

	t.Run("path storeId wins over body storeId", func(t *testing.T) {
		otherStore := e.provisionStore("other-store")

		req := testModel()
		req.StoreId = otherStore

		body, err := protojson.Marshal(req)
		if err != nil {
			t.Fatal(err)
		}
		w := e.do("POST", "/v1/stores/"+storeID+"/authorization-models", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		modelID, _ := resp["authorization_model_id"].(string)
		if modelID == "" {
			t.Error("expected non-empty authorization_model_id")
		}
		_, err = e.fga.ReadAuthorizationModel(context.Background(), &openfgav1.ReadAuthorizationModelRequest{StoreId: storeID, Id: modelID})
		require.NoError(t, err, "the model must land in the path's store")
		_, err = e.fga.ReadAuthorizationModel(context.Background(), &openfgav1.ReadAuthorizationModelRequest{StoreId: otherStore, Id: modelID})
		require.Error(t, err, "the model must not land in the body's store")
	})

	t.Run("send malformed authorization model returns 400", func(t *testing.T) {
		malformed := []byte(`{"foo": "bar", "unknown_garbage": 123}`)
		w := e.do("POST", "/v1/stores/"+storeID+"/authorization-models", malformed)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400: %s", w.Code, w.Body.String())
		}
	})
}
