package cmd

import (
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
)

const (
	privateFileMode os.FileMode = 0o600
	publicFileMode  os.FileMode = 0o644
	shortHashLength             = 12
)

var (
	errSchemaRequired = errors.New("build: --schema is required")
	errNodeNotFound   = errors.New("build: node not found — install Node.js from https://nodejs.org")
)

//go:embed runner.mjs
var runnerSrc []byte

func newBuildCmd() *cobra.Command {
	var s settings
	var schema, exportName string

	cmd := &cobra.Command{
		Use:   "build",
		Short: "Compile a TypeScript schema module to a model",
		RunE: func(cmd *cobra.Command, args []string) error {
			if schema == "" {
				return errSchemaRequired
			}
			if err := s.resolve(); err != nil {
				return err
			}
			return runBuild(schema, s.model, exportName)
		},
	}

	cmd.Flags().StringVarP(&schema, "schema", "s", "", "path to the TypeScript schema module (required)")
	s.bindModel(cmd, "out", "o")
	cmd.Flags().StringVarP(&exportName, "export", "e", "schema", "named export to read")

	return cmd
}

type compiledSchema struct {
	Model json.RawMessage `json:"model"`
	DSL   string          `json:"dsl"`
}

func runBuild(schema, out, exportName string) error {
	schemaAbs, err := filepath.Abs(schema)
	if err != nil {
		return fmt.Errorf("build: resolve schema path: %w", err)
	}
	compiled, err := compileSchema(schemaAbs, exportName)
	if err != nil {
		return err
	}
	outAbs, err := filepath.Abs(out)
	if err != nil {
		return fmt.Errorf("build: resolve output path: %w", err)
	}
	source, err := relativeToWorkingDirectory(schemaAbs)
	if err != nil {
		return err
	}
	hash, err := writeArtifact(outAbs, artifactContent{source: source, dsl: compiled.DSL, model: compiled.Model})
	if err != nil {
		return fmt.Errorf("build: %w", err)
	}
	printBuildSummary(out, hash, compiled.Model)
	return nil
}

func compileSchema(schemaAbs, exportName string) (compiledSchema, error) {
	var compiled compiledSchema
	node, err := findNode()
	if err != nil {
		return compiled, err
	}

	dir, err := os.MkdirTemp("", "peretyn-build-*")
	if err != nil {
		return compiled, fmt.Errorf("build: create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	runnerPath := filepath.Join(dir, "runner.mjs")
	if err := os.WriteFile(runnerPath, runnerSrc, privateFileMode); err != nil {
		return compiled, fmt.Errorf("build: write runner: %w", err)
	}
	compiledPath := filepath.Join(dir, "compiled.json")

	c := exec.Command(node, runnerPath, schemaAbs, exportName, compiledPath)
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	if err := c.Run(); err != nil {
		return compiled, fmt.Errorf("build: schema compile failed: %w", err)
	}

	raw, err := os.ReadFile(compiledPath)
	if err != nil {
		return compiled, fmt.Errorf("build: read compiled schema: %w", err)
	}
	if err := json.Unmarshal(raw, &compiled); err != nil {
		return compiled, fmt.Errorf("build: parse runner output: %w", err)
	}
	return compiled, nil
}

func relativeToWorkingDirectory(path string) (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("build: resolve working directory: %w", err)
	}
	relative, err := filepath.Rel(cwd, path)
	if err != nil {
		return "", fmt.Errorf("build: relativize schema path: %w", err)
	}
	return relative, nil
}

func printBuildSummary(out, hash string, model json.RawMessage) {
	var m struct {
		TypeDefinitions []json.RawMessage `json:"type_definitions"`
	}
	_ = json.Unmarshal(model, &m)
	fmt.Printf("✓ %s — %d types, hash %s\n", out, len(m.TypeDefinitions), hash[:shortHashLength])
	fmt.Printf("  next: PERETYN_TOKEN=<env key> peretyn apply --label v1\n")
}

func findNode() (string, error) {
	if path, err := exec.LookPath("node"); err == nil {
		return path, nil
	}
	return "", errNodeNotFound
}

func hashModel(model json.RawMessage) string {
	sum := sha256.Sum256(model)
	return hex.EncodeToString(sum[:])
}

type artifactContent struct {
	source string
	dsl    string
	model  json.RawMessage
}

func writeArtifact(outPath string, content artifactContent) (string, error) {
	hash := hashModel(content.model)
	a := struct {
		Peretyn     string          `json:"peretyn"`
		GeneratedAt string          `json:"generatedAt"`
		Source      string          `json:"source"`
		Hash        string          `json:"hash"`
		DSL         string          `json:"dsl"`
		Model       json.RawMessage `json:"model"`
	}{
		Peretyn:     "1",
		GeneratedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		Source:      content.source,
		Hash:        hash,
		DSL:         content.dsl,
		Model:       content.model,
	}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(a); err != nil {
		return "", fmt.Errorf("encode model: %w", err)
	}
	if err := os.WriteFile(outPath, buf.Bytes(), publicFileMode); err != nil {
		return "", fmt.Errorf("write %s: %w", outPath, err)
	}
	return hash, nil
}
