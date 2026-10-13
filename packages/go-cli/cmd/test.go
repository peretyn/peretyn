package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

const maxChecksPerBatch = 50

var (
	errNoAssertions     = errors.New("no assertions")
	errAssertionsFailed = errors.New("assertion(s) failed")
	errNoResult         = errors.New("no result for assertion")
	errAssertionErrored = errors.New("errored")
)

func newTestCmd() *cobra.Command {
	var s settings
	var file string
	cmd := &cobra.Command{
		Use:   "test",
		Short: "Check assertions against a deployed environment",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runTest(&s, file)
		},
	}
	cmd.Flags().StringVar(&file, "file", "peretyn.assertions.json", "path to the assertions file")
	s.bindToken(cmd)
	s.bindRuntime(cmd)
	return cmd
}

type assertion struct {
	Subject  string `json:"subject"`
	Relation string `json:"relation"`
	Object   string `json:"object"`
	Expect   bool   `json:"expect"`
}

type assertionFile struct {
	Assertions []assertion `json:"assertions"`
}

func runTest(s *settings, file string) error {
	if err := s.resolve(); err != nil {
		return err
	}
	if err := s.requireToken(); err != nil {
		return err
	}
	raw, err := os.ReadFile(file)
	if err != nil {
		return fmt.Errorf("read assertions %s: %w", file, err)
	}
	var af assertionFile
	if err := json.Unmarshal(raw, &af); err != nil {
		return fmt.Errorf("parse assertions %s: %w", file, err)
	}
	if len(af.Assertions) == 0 {
		return fmt.Errorf("%w in %s", errNoAssertions, file)
	}

	results, err := batchCheck(s, af.Assertions)
	if err != nil {
		return err
	}

	failures := 0
	for i, a := range af.Assertions {
		got := results[i]
		if got != a.Expect {
			failures++
			fmt.Printf("✗ %s#%s@%s  expected %v, got %v\n", a.Object, a.Relation, a.Subject, a.Expect, got)
		} else {
			fmt.Printf("✓ %s#%s@%s  %v\n", a.Object, a.Relation, a.Subject, got)
		}
	}

	fmt.Printf("\n%d passed, %d failed (%d total)\n", len(af.Assertions)-failures, failures, len(af.Assertions))
	if failures > 0 {
		return fmt.Errorf("%d %w", failures, errAssertionsFailed)
	}
	return nil
}

type tupleKey struct {
	User     string `json:"user"`
	Relation string `json:"relation"`
	Object   string `json:"object"`
}

type checkItem struct {
	TupleKey      tupleKey `json:"tuple_key"`
	CorrelationID string   `json:"correlation_id"`
}

type batchCheckResult struct {
	Allowed bool `json:"allowed"`
	Error   struct {
		Message string `json:"message"`
	} `json:"error"`
}

func correlationID(index int) string {
	return fmt.Sprintf("c%d", index)
}

func batchCheck(s *settings, assertions []assertion) ([]bool, error) {
	out := make([]bool, len(assertions))
	for start := 0; start < len(assertions); start += maxChecksPerBatch {
		end := min(start+maxChecksPerBatch, len(assertions))
		results, err := checkRange(s, assertions[start:end], start)
		if err != nil {
			return nil, err
		}
		copy(out[start:end], results)
	}
	return out, nil
}

func checkRange(s *settings, batch []assertion, firstIndex int) ([]bool, error) {
	items := make([]checkItem, 0, len(batch))
	for offset, a := range batch {
		items = append(items, checkItem{
			TupleKey:      tupleKey{User: a.Subject, Relation: a.Relation, Object: a.Object},
			CorrelationID: correlationID(firstIndex + offset),
		})
	}
	var resp struct {
		Result map[string]batchCheckResult `json:"result"`
	}
	request := postRequest{base: s.runtime, token: s.token, path: "/v1/batch-check", body: map[string]any{"checks": items}, out: &resp}
	if err := post(request); err != nil {
		return nil, fmt.Errorf("batch-check: %w", err)
	}
	allowed := make([]bool, 0, len(batch))
	for offset := range batch {
		result, err := lookupResult(resp.Result, firstIndex+offset)
		if err != nil {
			return nil, err
		}
		allowed = append(allowed, result.Allowed)
	}
	return allowed, nil
}

func lookupResult(results map[string]batchCheckResult, index int) (batchCheckResult, error) {
	result, ok := results[correlationID(index)]
	if !ok {
		return result, fmt.Errorf("%w %d", errNoResult, index)
	}
	if result.Error.Message != "" {
		return result, fmt.Errorf("assertion %d %w: %s", index, errAssertionErrored, result.Error.Message)
	}
	return result, nil
}
