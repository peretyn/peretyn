package http

import (
	"net/http"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func TestMultiTenancyIsolation(t *testing.T) {
	e := newTestEnv(t)

	storeA := e.provisionStore("store-a")
	storeB := e.provisionStore("store-b")
	e.writeModel(storeA)
	e.writeModel(storeB)

	tokenA := e.createKey(createKeyPayload{
		StoreID:         storeA,
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})
	tokenB := e.createKey(createKeyPayload{
		StoreID:         storeB,
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})

	e.writeTuple(tokenA, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc1"})

	t.Run("check isolation: tokenB cannot see store A data", func(t *testing.T) {
		req := &openfgav1.CheckRequest{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     "user:alice",
				Relation: "can_read",
				Object:   "document:doc1",
			},
		}
		w := e.do(tokenB, "POST /v1/check", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		if allowed, _ := resp["allowed"].(bool); allowed {
			t.Error("tokenB should NOT see store A's data (alice/doc1)")
		}
	})

	t.Run("store id smuggling ignored", func(t *testing.T) {
		req := &openfgav1.CheckRequest{
			StoreId: storeB,
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     "user:alice",
				Relation: "can_read",
				Object:   "document:doc1",
			},
		}
		w := e.do(tokenA, "POST /v1/check", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		if allowed, _ := resp["allowed"].(bool); !allowed {
			t.Error("smuggled storeId should be ignored; result should come from storeA (alice allowed)")
		}
	})

	t.Run("bidirectional isolation: write in B, check from A returns false", func(t *testing.T) {
		e.writeTuple(tokenB, &openfgav1.TupleKey{User: "user:bob", Relation: "viewer", Object: "document:doc1"})

		req := &openfgav1.CheckRequest{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     "user:bob",
				Relation: "can_read",
				Object:   "document:doc1",
			},
		}
		w := e.do(tokenA, "POST /v1/check", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		if allowed, _ := resp["allowed"].(bool); allowed {
			t.Error("store A should not have bob; isolation breach")
		}
	})

	t.Run("list-objects isolation", func(t *testing.T) {
		req := &openfgav1.ListObjectsRequest{
			User:     "user:alice",
			Relation: "can_read",
			Type:     "document",
		}
		w := e.do(tokenB, "POST /v1/list-objects", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		objects, _ := resp["objects"].([]any)
		for _, o := range objects {
			if o == "document:doc1" {
				t.Errorf("storeB should not contain alice's document:doc1 from storeA")
			}
		}
	})
}
