package http

import (
	"bytes"
	"net/http"
	"testing"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
)

func TestMalformedJSON(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	w := e.doRaw("POST /v1/check", map[string]string{
		"Authorization": "Bearer " + token,
		"Content-Type":  "application/json",
	}, []byte("{invalid json}"))
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400: %s", w.Code, w.Body.String())
	}
}

func TestEmptyBody(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	w := e.doRaw("POST /v1/check", map[string]string{
		"Authorization": "Bearer " + token,
		"Content-Type":  "application/json",
	}, []byte{})
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400: %s", w.Code, w.Body.String())
	}
}

func TestBodySizeLimitDecodeProto(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	body := bytes.Repeat([]byte("a"), 5*1024*1024)
	w := e.doRaw("POST /v1/check", map[string]string{
		"Authorization": "Bearer " + token,
		"Content-Type":  "application/json",
	}, body)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d, want 413: %s", w.Code, w.Body.String())
	}
}

func TestUnknownJSONFields(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	body := []byte(`{
		"unknown_field": "value",
		"tuple_key": {
			"user": "user:alice",
			"relation": "can_read",
			"object": "document:doc1"
		}
	}`)
	w := e.doRaw("POST /v1/check", map[string]string{
		"Authorization": "Bearer " + token,
		"Content-Type":  "application/json",
	}, body)
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200 (unknown fields ignored): %s", w.Code, w.Body.String())
	}
}

func TestFGAValidationErrorIs400(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	body := []byte(`{"tupleKey": {"user": "", "relation": "", "object": ""}}`)
	w := e.doRaw("POST /v1/check", map[string]string{
		"Authorization": "Bearer " + token,
		"Content-Type":  "application/json",
	}, body)
	require.Equal(t, http.StatusBadRequest, w.Code)
	var resp map[string]any
	decodeBody(t, w, &resp)
	require.NotEmpty(t, resp["error"])
	require.NotContains(t, resp["error"], "rpc error")
}

func TestEngineDeadlineIsGatewayTimeout(t *testing.T) {
	e := newTestEnv(t, func(d *Deps) { d.RequestTimeout = time.Nanosecond })
	_, token := setupStore(t, e)

	w := e.do(token, "POST /v1/check", &openfgav1.CheckRequest{
		TupleKey: &openfgav1.CheckRequestTupleKey{User: "user:alice", Relation: "can_read", Object: "document:doc1"},
	})
	require.Equal(t, http.StatusGatewayTimeout, w.Code)
	require.JSONEq(t, `{"error":"Gateway Timeout","code":504}`, w.Body.String())
}
