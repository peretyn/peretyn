package cmd

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildCmdArgs(t *testing.T) {
	tests := []struct {
		name    string
		args    []string
		wantErr string
	}{
		{name: "help exits clean", args: []string{"--help"}},
		{name: "schema required", args: nil, wantErr: "--schema is required"},
		{name: "schema required with only --out", args: []string{"--out", "x.json"}, wantErr: "--schema is required"},
		{name: "unknown flag", args: []string{"--nope"}, wantErr: "unknown flag"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := newBuildCmd()
			cmd.SetArgs(tt.args)
			cmd.SetOut(new(bytes.Buffer))
			cmd.SetErr(new(bytes.Buffer))
			err := cmd.Execute()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("build(%v) = %v, want nil", tt.args, err)
				}
				return
			}
			if err == nil {
				t.Fatalf("build(%v) = nil, want error containing %q", tt.args, tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("build(%v) = %q, want it to contain %q", tt.args, err, tt.wantErr)
			}
		})
	}
}

func TestWriteArtifact(t *testing.T) {
	out := filepath.Join(t.TempDir(), "peretyn.model.json")
	model := json.RawMessage(`{"expr":"a < b && c > d"}`)

	if _, err := writeArtifact(out, artifactContent{source: "src/schema.ts", dsl: "model\n  schema 1.1\n", model: model}); err != nil {
		t.Fatalf("writeArtifact: %v", err)
	}

	raw, err := os.ReadFile(out)
	if err != nil {
		t.Fatalf("read artifact: %v", err)
	}
	if strings.Contains(string(raw), `\u003c`) {
		t.Error("model was HTML-escaped; JSON.stringify does not escape, so the bytes would diverge")
	}
	if !strings.Contains(string(raw), `a < b && c > d`) {
		t.Error("model bytes did not survive verbatim")
	}

	var a struct {
		GeneratedAt string          `json:"generatedAt"`
		Hash        string          `json:"hash"`
		Model       json.RawMessage `json:"model"`
	}
	if err := json.Unmarshal(raw, &a); err != nil {
		t.Fatalf("parse artifact: %v", err)
	}

	var compact bytes.Buffer
	if err := json.Compact(&compact, a.Model); err != nil {
		t.Fatalf("compact model: %v", err)
	}
	if got := hashModel(compact.Bytes()); got != a.Hash {
		t.Errorf("hash = %q, want sha256 of the compact model %q", a.Hash, got)
	}
	if len(a.GeneratedAt) != len("2006-01-02T15:04:05.000Z") {
		t.Errorf("generatedAt = %q, want fixed-width millisecond precision", a.GeneratedAt)
	}
}
