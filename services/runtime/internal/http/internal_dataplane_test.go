package http

import (
	"net/http"
	"testing"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

func TestInternalDataPlane(t *testing.T) {
	e := newTestEnv(t)
	storeID := e.provisionStore("test")
	e.writeModel(storeID)

	marshal := func(m proto.Message) []byte {
		b, err := protojson.Marshal(m)
		require.NoError(t, err)
		return b
	}

	writeReq := &openfgav1.WriteRequest{
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: []*openfgav1.TupleKey{
				{User: "user:alice", Relation: "viewer", Object: "document:doc1"},
			},
		},
	}
	w := e.doInternal("POST /v1/internal/stores/"+storeID+"/write", marshal(writeReq))
	require.Equal(t, http.StatusOK, w.Code, "internal write: %s", w.Body.String())

	w = e.doInternal("POST /v1/internal/stores/"+storeID+"/read", marshal(&openfgav1.ReadRequest{}))
	require.Equal(t, http.StatusOK, w.Code, "internal read: %s", w.Body.String())
	var readResp openfgav1.ReadResponse
	decodeProtoBody(t, w, &readResp)
	require.Len(t, readResp.GetTuples(), 1)
	require.Equal(t, "user:alice", readResp.GetTuples()[0].GetKey().GetUser())

	checkReq := &openfgav1.CheckRequest{
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User: "user:alice", Relation: "can_read", Object: "document:doc1",
		},
	}
	w = e.doInternal("POST /v1/internal/stores/"+storeID+"/check", marshal(checkReq))
	require.Equal(t, http.StatusOK, w.Code, "internal check: %s", w.Body.String())
	var checkResp map[string]any
	decodeBody(t, w, &checkResp)
	require.True(t, checkResp["allowed"].(bool))

	expandReq := &openfgav1.ExpandRequest{
		TupleKey: &openfgav1.ExpandRequestTupleKey{Relation: "viewer", Object: "document:doc1"},
	}
	w = e.doInternal("POST /v1/internal/stores/"+storeID+"/expand", marshal(expandReq))
	require.Equal(t, http.StatusOK, w.Code, "internal expand: %s", w.Body.String())
	require.Contains(t, w.Body.String(), "user:alice")

	w = e.doRawInternal("POST /v1/internal/stores/"+storeID+"/read", nil, marshal(&openfgav1.ReadRequest{}))
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestInternalDeadlineIsGatewayTimeout(t *testing.T) {
	e := newTestEnv(t, func(d *Deps) { d.InternalRequestTimeout = time.Nanosecond })

	w := e.doInternal("POST /v1/stores", []byte(`{"name":"slow"}`))
	require.Equal(t, http.StatusGatewayTimeout, w.Code, w.Body.String())
}
