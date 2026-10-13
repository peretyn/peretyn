package cmd

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/cobra"
)

func execute(t *testing.T, cmd *cobra.Command, args ...string) (string, error) {
	t.Helper()
	var out bytes.Buffer
	cmd.SetOut(&out)
	cmd.SetErr(&out)
	cmd.SetArgs(args)
	err := cmd.Execute()
	return out.String(), err
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestHelpDoesNotPrintToken(t *testing.T) {
	t.Setenv("PERETYN_TOKEN", "prn_live_secret")
	for name, newCmd := range map[string]func() *cobra.Command{
		"plan":  newPlanCmd,
		"apply": newApplyCmd,
		"test":  newTestCmd,
	} {
		t.Run(name, func(t *testing.T) {
			out, err := execute(t, newCmd(), "--help")
			if err != nil {
				t.Fatalf("%s --help: %v", name, err)
			}
			if strings.Contains(out, "prn_live_secret") {
				t.Errorf("%s --help printed $PERETYN_TOKEN:\n%s", name, out)
			}
		})
	}
}

func TestPlanReadsTokenAndControlFromEnv(t *testing.T) {
	t.Chdir(t.TempDir())
	var gotAuth string
	control := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"hasChanges":false}`))
	}))
	defer control.Close()
	t.Setenv("PERETYN_TOKEN", "prn_test_env")
	t.Setenv("PERETYN_CONTROL_URL", control.URL)
	writeFile(t, "peretyn.model.json", `{"dsl":"model","model":{}}`)

	if _, err := execute(t, newPlanCmd()); err != nil {
		t.Fatalf("plan: %v", err)
	}
	if gotAuth != "Bearer prn_test_env" {
		t.Errorf("Authorization = %q, want the $PERETYN_TOKEN bearer", gotAuth)
	}
}

func TestMalformedConfigIsAnError(t *testing.T) {
	for name, tc := range map[string]struct {
		newCmd func() *cobra.Command
		args   []string
	}{
		"build": {newBuildCmd, []string{"--schema", "schema.ts"}},
		"plan":  {newPlanCmd, []string{"--token", "t"}},
		"apply": {newApplyCmd, []string{"--token", "t", "--label", "v1"}},
		"test":  {newTestCmd, []string{"--token", "t"}},
	} {
		t.Run(name, func(t *testing.T) {
			t.Chdir(t.TempDir())
			writeFile(t, "peretyn.json", `{"model": `)
			_, err := execute(t, tc.newCmd(), tc.args...)
			if err == nil || !strings.Contains(err.Error(), "peretyn.json") {
				t.Errorf("%s with a malformed peretyn.json = %v, want an error naming peretyn.json", name, err)
			}
		})
	}
}

func TestBuildWritesToConfiguredModelPath(t *testing.T) {
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node not installed")
	}
	t.Chdir(t.TempDir())
	writeFile(t, "node_modules/@peretyn/sdk/package.json", `{"name":"@peretyn/sdk","type":"module","main":"index.js"}`)
	writeFile(t, "node_modules/@peretyn/sdk/index.js", `
export const schemaToOpenFGA = () => ({ schema_version: '1.1', type_definitions: [{ type: 'user' }] });
export const schemaToDsl = () => 'model\n  schema 1.1\n\ntype user\n';
`)
	writeFile(t, "schema.mjs", `export const schema = { user: {} };`)
	writeFile(t, "peretyn.json", `{"model": "custom.model.json"}`)

	if _, err := execute(t, newBuildCmd(), "--schema", "schema.mjs"); err != nil {
		t.Fatalf("build: %v", err)
	}
	raw, err := os.ReadFile("custom.model.json")
	if err != nil {
		t.Fatalf("build did not write the peretyn.json model path: %v", err)
	}
	var a artifact
	if err := json.Unmarshal(raw, &a); err != nil || a.DSL == "" {
		t.Errorf("artifact = %s (%v), want a dsl", raw, err)
	}
}
