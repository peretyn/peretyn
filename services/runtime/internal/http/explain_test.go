package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
)

func writeRequest(tuple *openfgav1.TupleKey) proto.Message {
	return &openfgav1.WriteRequest{Writes: &openfgav1.WriteRequestWrites{TupleKeys: []*openfgav1.TupleKey{tuple}}}
}

func checkRequest(user, relation, object string) proto.Message {
	return &openfgav1.CheckRequest{TupleKey: &openfgav1.CheckRequestTupleKey{User: user, Relation: relation, Object: object}}
}

func errorBody(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var resp struct {
		Error string `json:"error"`
	}
	decodeBody(t, w, &resp)
	return resp.Error
}

func TestEngineErrorsSpeakPeretyn(t *testing.T) {
	tests := []struct {
		name    string
		route   string
		request func() proto.Message
		want    string
	}{
		{
			name:  "writing a tuple to a permission",
			route: "POST /v1/write",
			request: func() proto.Message {
				return writeRequest(&openfgav1.TupleKey{User: "user:bob", Relation: "can_read", Object: "document:roadmap"})
			},
			want: `"can_read" is a permission of "document", so tuples can't be written to it. Write the tuple to a relation that "can_read" is computed from.`,
		},
		{
			name:  "writing a subject type the relation doesn't accept",
			route: "POST /v1/write",
			request: func() proto.Message {
				return writeRequest(&openfgav1.TupleKey{User: "document:specs", Relation: "viewer", Object: "document:roadmap"})
			},
			want: `relation "viewer" of "document" doesn't accept "document" subjects. The schema allows: user. Add "document" to its targets, or write a subject it accepts.`,
		},
		{
			name:  "writing a tuple to an undefined relation",
			route: "POST /v1/write",
			request: func() proto.Message {
				return writeRequest(&openfgav1.TupleKey{User: "user:bob", Relation: "ghost", Object: "document:roadmap"})
			},
			want: `"ghost" is not a relation or permission of "document" in the published schema.`,
		},
		{
			name:  "checking an undefined relation",
			route: "POST /v1/check",
			request: func() proto.Message {
				return checkRequest("user:bob", "ghost", "document:roadmap")
			},
			want: `"ghost" is not a relation or permission of "document" in the published schema.`,
		},
		{
			name:  "checking an object of an unknown type",
			route: "POST /v1/check",
			request: func() proto.Message {
				return checkRequest("user:bob", "viewer", "folder:specs")
			},
			want: `"folder" is not a type in the published schema.`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := newTestEnv(t)
			_, token := setupStore(t, e)

			w := e.do(token, tt.route, tt.request())

			require.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
			require.Equal(t, tt.want, errorBody(t, w))
		})
	}
}

func TestEngineErrorsBeforeTheFirstSchema(t *testing.T) {
	e := newTestEnv(t)
	storeID := e.provisionStore("empty")
	token := e.createKey(createKeyPayload{StoreID: storeID, ProjectSlug: "test", EnvironmentName: "dev"})

	for _, route := range []string{"POST /v1/write", "POST /v1/check"} {
		t.Run(route, func(t *testing.T) {
			request := checkRequest("user:bob", "viewer", "document:roadmap")
			if route == "POST /v1/write" {
				request = writeRequest(&openfgav1.TupleKey{User: "user:bob", Relation: "viewer", Object: "document:roadmap"})
			}

			w := e.do(token, route, request)

			require.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
			require.Equal(t, `this environment has no published schema yet. Publish one with "peretyn apply", then retry.`, errorBody(t, w))
		})
	}
}
