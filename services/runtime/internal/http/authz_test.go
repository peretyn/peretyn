package http

import (
	"net/http"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func TestAuthzCorrectness(t *testing.T) {
	e := newTestEnv(t)
	storeID := e.provisionStore("authz")
	e.writeModel(storeID)
	token := e.createKey(createKeyPayload{
		StoreID:         storeID,
		ProjectSlug:     "authz",
		EnvironmentName: "test",
	})

	tests := []struct {
		name     string
		setup    func()
		user     string
		relation string
		object   string
		allowed  bool
	}{
		{
			name: "direct viewer can_read",
			setup: func() {
				e.writeTuple(token, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:d1"})
			},
			user:     "user:alice",
			relation: "can_read",
			object:   "document:d1",
			allowed:  true,
		},
		{
			name: "direct editor can_read",
			setup: func() {
				e.writeTuple(token, &openfgav1.TupleKey{User: "user:bob", Relation: "editor", Object: "document:d2"})
			},
			user:     "user:bob",
			relation: "can_read",
			object:   "document:d2",
			allowed:  true,
		},
		{
			name:     "no relation denied",
			setup:    func() {},
			user:     "user:charlie",
			relation: "can_read",
			object:   "document:d3",
			allowed:  false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tc.setup()

			req := &openfgav1.CheckRequest{
				TupleKey: &openfgav1.CheckRequestTupleKey{
					User:     tc.user,
					Relation: tc.relation,
					Object:   tc.object,
				},
			}
			w := e.do(token, "POST /v1/check", req)
			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
			}
			var resp map[string]any
			decodeBody(t, w, &resp)
			got, _ := resp["allowed"].(bool)
			if got != tc.allowed {
				t.Errorf("allowed = %v, want %v (user=%s rel=%s obj=%s)", got, tc.allowed, tc.user, tc.relation, tc.object)
			}
		})
	}

	t.Run("revoke on delete", func(t *testing.T) {
		e2 := newTestEnv(t)
		sid := e2.provisionStore("revoke")
		e2.writeModel(sid)
		tok := e2.createKey(createKeyPayload{
			StoreID:         sid,
			ProjectSlug:     "revoke",
			EnvironmentName: "test",
		})
		e2.writeTuple(tok, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc1"})

		checkReq := &openfgav1.CheckRequest{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     "user:alice",
				Relation: "can_read",
				Object:   "document:doc1",
			},
		}
		w := e2.do(tok, "POST /v1/check", checkReq)
		if w.Code != http.StatusOK {
			t.Fatalf("pre-delete check status = %d: %s", w.Code, w.Body.String())
		}
		var resp1 map[string]any
		decodeBody(t, w, &resp1)
		if allowed, _ := resp1["allowed"].(bool); !allowed {
			t.Error("expected allowed=true before delete")
		}

		deleteReq := &openfgav1.WriteRequest{
			Deletes: &openfgav1.WriteRequestDeletes{
				TupleKeys: []*openfgav1.TupleKeyWithoutCondition{
					{User: "user:alice", Relation: "viewer", Object: "document:doc1"},
				},
			},
		}
		w2 := e2.do(tok, "POST /v1/write", deleteReq)
		if w2.Code != http.StatusOK {
			t.Fatalf("delete status = %d: %s", w2.Code, w2.Body.String())
		}

		w3 := e2.do(tok, "POST /v1/check", checkReq)
		if w3.Code != http.StatusOK {
			t.Fatalf("post-delete check status = %d: %s", w3.Code, w3.Body.String())
		}
		var resp3 map[string]any
		decodeBody(t, w3, &resp3)
		if allowed, _ := resp3["allowed"].(bool); allowed {
			t.Error("expected allowed=false after delete")
		}
	})
}
