package http

import (
	"net/http"
	"strings"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

func setupStore(t *testing.T, e *testEnv) (storeID, token string) {
	t.Helper()
	storeID = e.provisionStore("test")
	e.writeModel(storeID)
	token = e.createKey(createKeyPayload{
		StoreID:         storeID,
		ProjectSlug:     "test",
		EnvironmentName: "dev",
	})
	return
}

func TestHealthz(t *testing.T) {
	e := newTestEnv(t)
	w := e.doRaw("GET /healthz", nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp map[string]string
	decodeBody(t, w, &resp)
	if resp["status"] != "ok" {
		t.Errorf(`status = %q, want "ok"`, resp["status"])
	}
}

func TestMe(t *testing.T) {
	e := newTestEnv(t)
	storeID, token := setupStore(t, e)

	w := e.do(token, "GET /v1/me", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
	}

	var resp map[string]string
	decodeBody(t, w, &resp)

	if resp["storeId"] != storeID {
		t.Errorf("storeId = %q, want %q", resp["storeId"], storeID)
	}
	if resp["environment"] != "dev" {
		t.Errorf("environment = %q, want dev", resp["environment"])
	}
	if resp["projectSlug"] != "test" {
		t.Errorf("projectSlug = %q, want test", resp["projectSlug"])
	}
	if resp["kind"] != "env" {
		t.Errorf("kind = %q, want env", resp["kind"])
	}

	if strings.Contains(w.Body.String(), token) {
		t.Errorf("response body contains the raw token")
	}
}

func TestCheck(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	e.writeTuple(token, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc1"})

	t.Run("alice can_read doc1 via viewer", func(t *testing.T) {
		req := &openfgav1.CheckRequest{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     "user:alice",
				Relation: "can_read",
				Object:   "document:doc1",
			},
		}
		w := e.do(token, "POST /v1/check", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		if allowed, _ := resp["allowed"].(bool); !allowed {
			t.Errorf("expected allowed=true, got %v", resp["allowed"])
		}
	})

	t.Run("bob cannot read doc1", func(t *testing.T) {
		req := &openfgav1.CheckRequest{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     "user:bob",
				Relation: "can_read",
				Object:   "document:doc1",
			},
		}
		w := e.do(token, "POST /v1/check", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		if allowed, _ := resp["allowed"].(bool); allowed {
			t.Errorf("expected allowed=false, got %v", resp["allowed"])
		}
	})
}

func TestBatchCheck(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	e.writeTuple(token, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc1"})
	e.writeTuple(token, &openfgav1.TupleKey{User: "user:bob", Relation: "editor", Object: "document:doc2"})

	t.Run("batch check with 3 items", func(t *testing.T) {
		req := &openfgav1.BatchCheckRequest{
			Checks: []*openfgav1.BatchCheckItem{
				{
					TupleKey:      &openfgav1.CheckRequestTupleKey{User: "user:alice", Relation: "can_read", Object: "document:doc1"},
					CorrelationId: "c1",
				},
				{
					TupleKey:      &openfgav1.CheckRequestTupleKey{User: "user:bob", Relation: "can_read", Object: "document:doc2"},
					CorrelationId: "c2",
				},
				{
					TupleKey:      &openfgav1.CheckRequestTupleKey{User: "user:charlie", Relation: "can_read", Object: "document:doc1"},
					CorrelationId: "c3",
				},
			},
		}
		w := e.do(token, "POST /v1/batch-check", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)

		result, _ := resp["result"].(map[string]any)
		if result == nil {
			t.Fatalf("result is nil, resp=%v", resp)
		}

		c1, _ := result["c1"].(map[string]any)
		c2, _ := result["c2"].(map[string]any)
		c3, _ := result["c3"].(map[string]any)

		if allowed, _ := c1["allowed"].(bool); !allowed {
			t.Errorf("c1 (alice/doc1) expected allowed=true")
		}
		if allowed, _ := c2["allowed"].(bool); !allowed {
			t.Errorf("c2 (bob/doc2) expected allowed=true")
		}
		if allowed, _ := c3["allowed"].(bool); allowed {
			t.Errorf("c3 (charlie/doc1) expected allowed=false")
		}
	})

	t.Run("empty checks list returns 400 (FGA requires at least 1 item)", func(t *testing.T) {
		req := &openfgav1.BatchCheckRequest{Checks: []*openfgav1.BatchCheckItem{}}
		w := e.do(token, "POST /v1/batch-check", req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400: %s", w.Code, w.Body.String())
		}
	})
}

func TestWrite(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	t.Run("write tuple returns 200", func(t *testing.T) {
		req := &openfgav1.WriteRequest{
			Writes: &openfgav1.WriteRequestWrites{
				TupleKeys: []*openfgav1.TupleKey{
					{User: "user:alice", Relation: "viewer", Object: "document:doc1"},
				},
			},
		}
		w := e.do(token, "POST /v1/write", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
	})

	t.Run("write same tuple again returns 400", func(t *testing.T) {
		req := &openfgav1.WriteRequest{
			Writes: &openfgav1.WriteRequestWrites{
				TupleKeys: []*openfgav1.TupleKey{
					{User: "user:alice", Relation: "viewer", Object: "document:doc1"},
				},
			},
		}
		w := e.do(token, "POST /v1/write", req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400: %s", w.Code, w.Body.String())
		}
	})

	t.Run("write and delete in same request", func(t *testing.T) {
		req := &openfgav1.WriteRequest{
			Writes: &openfgav1.WriteRequestWrites{
				TupleKeys: []*openfgav1.TupleKey{
					{User: "user:alice", Relation: "viewer", Object: "document:doc2"},
				},
			},
			Deletes: &openfgav1.WriteRequestDeletes{
				TupleKeys: []*openfgav1.TupleKeyWithoutCondition{
					{User: "user:alice", Relation: "viewer", Object: "document:doc1"},
				},
			},
		}
		w := e.do(token, "POST /v1/write", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
	})
}

func TestExpand(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	e.writeTuple(token, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc1"})

	t.Run("expand viewer on doc1 returns tree", func(t *testing.T) {
		req := &openfgav1.ExpandRequest{
			TupleKey: &openfgav1.ExpandRequestTupleKey{
				Relation: "viewer",
				Object:   "document:doc1",
			},
		}
		w := e.do(token, "POST /v1/expand", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		if resp["tree"] == nil {
			t.Errorf("expected tree in response, got %v", resp)
		}
	})

	t.Run("expand non-existent relation returns 400", func(t *testing.T) {
		req := &openfgav1.ExpandRequest{
			TupleKey: &openfgav1.ExpandRequestTupleKey{
				Relation: "nonexistent",
				Object:   "document:doc1",
			},
		}
		w := e.do(token, "POST /v1/expand", req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400: %s", w.Code, w.Body.String())
		}
	})
}

func TestListObjects(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	e.writeTuple(token, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc1"})
	e.writeTuple(token, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc2"})

	t.Run("list objects for alice can_read returns doc1 and doc2", func(t *testing.T) {
		req := &openfgav1.ListObjectsRequest{
			User:     "user:alice",
			Relation: "can_read",
			Type:     "document",
		}
		w := e.do(token, "POST /v1/list-objects", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		objects, _ := resp["objects"].([]any)
		if len(objects) < 2 {
			t.Errorf("expected at least 2 objects, got %v", objects)
		}
	})

	t.Run("list objects for charlie returns empty list", func(t *testing.T) {
		req := &openfgav1.ListObjectsRequest{
			User:     "user:charlie",
			Relation: "can_read",
			Type:     "document",
		}
		w := e.do(token, "POST /v1/list-objects", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
	})
}

func TestListUsers(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	e.writeTuple(token, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc1"})
	e.writeTuple(token, &openfgav1.TupleKey{User: "user:bob", Relation: "editor", Object: "document:doc1"})

	t.Run("list users for doc1 can_read returns alice and bob", func(t *testing.T) {
		req := &openfgav1.ListUsersRequest{
			Object:      &openfgav1.Object{Type: "document", Id: "doc1"},
			Relation:    "can_read",
			UserFilters: []*openfgav1.UserTypeFilter{{Type: "user"}},
		}
		w := e.do(token, "POST /v1/list-users", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		users, _ := resp["users"].([]any)
		if len(users) < 2 {
			t.Errorf("expected at least 2 users, got %v", users)
		}
	})

	t.Run("list users for doc99 returns empty list", func(t *testing.T) {
		req := &openfgav1.ListUsersRequest{
			Object:      &openfgav1.Object{Type: "document", Id: "doc99"},
			Relation:    "can_read",
			UserFilters: []*openfgav1.UserTypeFilter{{Type: "user"}},
		}
		w := e.do(token, "POST /v1/list-users", req)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
	})
}

func TestReadChanges(t *testing.T) {
	e := newTestEnv(t)
	_, token := setupStore(t, e)

	e.writeTuple(token, &openfgav1.TupleKey{User: "user:alice", Relation: "viewer", Object: "document:doc1"})

	t.Run("GET /v1/changes returns non-empty changes", func(t *testing.T) {
		w := e.do(token, "GET /v1/changes", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		changes, _ := resp["changes"].([]any)
		if len(changes) == 0 {
			t.Errorf("expected non-empty changes array")
		}
	})

	t.Run("GET /v1/changes with type filter returns 200", func(t *testing.T) {
		w := e.do(token, "GET /v1/changes?type=document", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
	})

	t.Run("continuation_token returned in response", func(t *testing.T) {
		w := e.do(token, "GET /v1/changes", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200: %s", w.Code, w.Body.String())
		}
		var resp map[string]any
		decodeBody(t, w, &resp)
		if _, ok := resp["continuation_token"]; !ok {
			t.Errorf("continuation_token missing from %v", resp)
		}
	})
}

func TestMethodMismatch(t *testing.T) {
	e := newTestEnv(t)

	t.Run("POST /healthz returns 405", func(t *testing.T) {
		w := e.doRaw("POST /healthz", nil, nil)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("status = %d, want 405", w.Code)
		}
	})

	t.Run("GET /v1/check returns 405 (mux rejects before auth, header irrelevant)", func(t *testing.T) {
		w := e.doRaw("GET /v1/check", nil, nil)
		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("status = %d, want 405", w.Code)
		}
	})
}
