package cmd

import (
	"errors"
	"fmt"
	"strings"
)

const (
	schemaErrorExitCode = 2
	esmHint             = `hint: the schema is an ES module but Node loads it as CommonJS — add "type": "module" to the nearest package.json, or rename the schema to .mts`
)

var esmFailureMarkers = []string{
	"Cannot use import statement outside a module",
	"ERR_REQUIRE_ESM",
	"Unexpected token 'export'",
}

var (
	errSchemaInvalid       = errors.New("build: schema is invalid")
	errSchemaCompileFailed = errors.New("build: schema compile failed")
)

type compileFailure struct {
	exitCode int
	stderr   string
}

func explainCompileFailure(failure compileFailure) error {
	output := strings.TrimSpace(failure.stderr)
	if failure.exitCode == schemaErrorExitCode && output != "" {
		return fmt.Errorf("%w\n%s", errSchemaInvalid, output)
	}
	if output == "" {
		return fmt.Errorf("%w: exit status %d", errSchemaCompileFailed, failure.exitCode)
	}
	if isESMFailure(output) {
		return fmt.Errorf("%w:\n%s\n\n%s", errSchemaCompileFailed, output, esmHint)
	}
	return fmt.Errorf("%w:\n%s", errSchemaCompileFailed, output)
}

func isESMFailure(output string) bool {
	for _, marker := range esmFailureMarkers {
		if strings.Contains(output, marker) {
			return true
		}
	}
	return false
}
