package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func writeAssertions(t *testing.T, n int) {
	t.Helper()
	var af assertionFile
	for i := range n {
		af.Assertions = append(af.Assertions, assertion{
			Subject:  "user:alice",
			Relation: "viewer",
			Object:   fmt.Sprintf("document:%d", i),
			Expect:   i%2 == 0,
		})
	}
	raw, err := json.Marshal(af)
	if err != nil {
		t.Fatal(err)
	}
	writeFile(t, "peretyn.assertions.json", string(raw))
}

func TestTestSplitsAssertionsIntoBatchesOf50(t *testing.T) {
	t.Chdir(t.TempDir())
	writeAssertions(t, 120)
	var batches []int
	runtime := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer prn_test_env" {
			http.Error(w, "bad token "+got, http.StatusUnauthorized)
			return
		}
		var req struct {
			Checks []struct {
				TupleKey struct {
					Object string `json:"object"`
				} `json:"tuple_key"`
				CorrelationID string `json:"correlation_id"`
			} `json:"checks"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		batches = append(batches, len(req.Checks))
		if len(req.Checks) > 50 {
			http.Error(w, "the maximum allowed is 50", http.StatusBadRequest)
			return
		}
		result := map[string]map[string]bool{}
		for _, c := range req.Checks {
			var i int
			_, _ = fmt.Sscanf(c.TupleKey.Object, "document:%d", &i)
			result[c.CorrelationID] = map[string]bool{"allowed": i%2 == 0}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"result": result})
	}))
	defer runtime.Close()
	t.Setenv("PERETYN_TOKEN", "prn_test_env")

	if _, err := execute(t, newTestCmd(), "--runtime", runtime.URL+"/"); err != nil {
		t.Fatalf("test: %v", err)
	}
	if fmt.Sprint(batches) != "[50 50 20]" {
		t.Errorf("batch sizes = %v, want [50 50 20]", batches)
	}
}

func TestTestRejectsMalformedRuntimeURL(t *testing.T) {
	t.Chdir(t.TempDir())
	writeAssertions(t, 1)

	_, err := execute(t, newTestCmd(), "--token", "t", "--runtime", "http://[::1")
	if err == nil || !strings.Contains(err.Error(), "::1") {
		t.Errorf("test with a malformed --runtime = %v, want a URL error", err)
	}
}
