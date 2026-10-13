package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/peretyn/peretyn/services/runtime/internal/fga/fgatest"
	"github.com/peretyn/peretyn/services/runtime/internal/http/keys"
	"github.com/peretyn/peretyn/services/runtime/internal/http/keys/keystest"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type testEnv struct {
	t        *testing.T
	handler  http.Handler
	internal http.Handler
	secret   string
}

func newTestEnv(t *testing.T, opts ...func(*Deps)) *testEnv {
	t.Helper()
	deps := Deps{
		FGA:            fgatest.NewServer(t),
		Logger:         zap.NewNop(),
		Keys:           keys.NewStore(keystest.NewMemoryRepository(), "prn_"),
		InternalSecret: "test-secret",
	}
	for _, opt := range opts {
		opt(&deps)
	}

	return &testEnv{
		t:        t,
		handler:  NewPublicHandler(deps),
		internal: NewInternalHandler(deps),
		secret:   deps.InternalSecret,
	}
}

func newRouteRequest(route string, body []byte) *http.Request {
	method, path, _ := strings.Cut(route, " ")
	return httptest.NewRequest(method, path, bytes.NewReader(body))
}

func (e *testEnv) do(token, route string, msg proto.Message) *httptest.ResponseRecorder {
	e.t.Helper()
	var body []byte
	if msg != nil {
		var err error
		body, err = protojson.Marshal(msg)
		require.NoError(e.t, err)
	}
	req := newRouteRequest(route, body)
	req.Header.Set("Authorization", "Bearer "+token)
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	e.handler.ServeHTTP(w, req)
	return w
}

func (e *testEnv) doInternal(route string, body []byte) *httptest.ResponseRecorder {
	e.t.Helper()
	req := newRouteRequest(route, body)
	req.Header.Set("X-Peretyn-Internal-Secret", e.secret)
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	e.internal.ServeHTTP(w, req)
	return w
}

func (e *testEnv) doRaw(route string, headers map[string]string, body []byte) *httptest.ResponseRecorder {
	e.t.Helper()
	req := newRouteRequest(route, body)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	e.handler.ServeHTTP(w, req)
	return w
}

func (e *testEnv) doRawInternal(route string, headers map[string]string, body []byte) *httptest.ResponseRecorder {
	e.t.Helper()
	req := newRouteRequest(route, body)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	e.internal.ServeHTTP(w, req)
	return w
}

func (e *testEnv) provisionStore(name string) string {
	e.t.Helper()
	body, err := json.Marshal(map[string]string{"name": name})
	require.NoError(e.t, err)
	w := e.doInternal("POST /v1/stores", body)
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
	w := e.doInternal("POST /v1/stores/"+storeID+"/authorization-models", body)
	require.Equal(e.t, http.StatusCreated, w.Code, "writeModel: unexpected status: %s", w.Body.String())
	var resp map[string]any
	decodeBody(e.t, w, &resp)
	modelID, ok := resp["authorization_model_id"].(string)
	require.True(e.t, ok && modelID != "", "writeModel: missing authorization_model_id in response")
	return modelID
}

type createKeyPayload struct {
	EnvironmentUUID string `json:"environmentUuid"`
	StoreID         string `json:"storeId"`
	ProjectSlug     string `json:"projectSlug"`
	EnvironmentName string `json:"environmentName"`
}

func (e *testEnv) createKey(p createKeyPayload) string {
	e.t.Helper()
	p.EnvironmentUUID = uuid.NewString()
	body, err := json.Marshal(p)
	require.NoError(e.t, err)
	w := e.doInternal("POST /v1/internal/keys", body)
	require.Equal(e.t, http.StatusCreated, w.Code, "createKey: unexpected status: %s", w.Body.String())
	var resp map[string]any
	decodeBody(e.t, w, &resp)
	token, ok := resp["plaintext"].(string)
	require.True(e.t, ok && token != "", "createKey: missing plaintext in response")
	return token
}

func (e *testEnv) writeTuple(token string, tuple *openfgav1.TupleKey) {
	e.t.Helper()
	req := &openfgav1.WriteRequest{
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: []*openfgav1.TupleKey{tuple},
		},
	}
	w := e.do(token, "POST /v1/write", req)
	require.Equal(e.t, http.StatusOK, w.Code, "writeTuple: unexpected status: %s", w.Body.String())
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
					"can_read": {Userset: &openfgav1.Userset_Union{Union: &openfgav1.Usersets{
						Child: []*openfgav1.Userset{
							{Userset: &openfgav1.Userset_ComputedUserset{ComputedUserset: &openfgav1.ObjectRelation{Relation: "viewer"}}},
							{Userset: &openfgav1.Userset_ComputedUserset{ComputedUserset: &openfgav1.ObjectRelation{Relation: "editor"}}},
						},
					}}},
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

func decodeBody(t *testing.T, w *httptest.ResponseRecorder, v any) {
	t.Helper()
	err := json.Unmarshal(w.Body.Bytes(), v)
	require.NoError(t, err, "decodeBody: body=%s", w.Body.String())
}

func decodeProtoBody(t *testing.T, w *httptest.ResponseRecorder, msg proto.Message) {
	t.Helper()
	u := protojson.UnmarshalOptions{DiscardUnknown: true}
	err := u.Unmarshal(w.Body.Bytes(), msg)
	require.NoError(t, err, "decodeProtoBody: body=%s", w.Body.String())
}
