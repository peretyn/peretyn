package cmd

import (
	"strings"
	"testing"
)

func TestExplainCompileFailure(t *testing.T) {
	tests := []struct {
		name         string
		failure      compileFailure
		wantContains []string
		wantAbsent   []string
	}{
		{
			name: "a schema mistake is shown as the runner located it",
			failure: compileFailure{
				exitCode: schemaErrorExitCode,
				stderr:   "src/schema.ts:7:31: Peretyn schema: type \"doc\" permission \"view\": \"ghost\" is not a relation or permission of \"doc\"\n",
			},
			wantContains: []string{"src/schema.ts:7:31: Peretyn schema: type \"doc\" permission \"view\""},
			wantAbsent:   []string{"exit status", "compile failed"},
		},
		{
			name: "an ESM schema in a CommonJS package gets a hint",
			failure: compileFailure{
				exitCode: 1,
				stderr:   "file:///app/schema.ts:1\nimport { defineSchema } from '@peretyn/sdk';\n^^^^^^\n\nSyntaxError: Cannot use import statement outside a module\n    at wrapSafe (node:internal/modules/cjs/loader:1)\n",
			},
			wantContains: []string{"SyntaxError: Cannot use import statement outside a module", `"type": "module"`, ".mts"},
		},
		{
			name: "a require of an ES module gets the same hint",
			failure: compileFailure{
				exitCode: 1,
				stderr:   "Error [ERR_REQUIRE_ESM]: require() of ES Module /app/node_modules/@peretyn/sdk/dist/index.js not supported.\n",
			},
			wantContains: []string{"ERR_REQUIRE_ESM", `"type": "module"`},
		},
		{
			name:         "any other loader failure shows its output",
			failure:      compileFailure{exitCode: 1, stderr: "Error: Cannot find module '@peretyn/sdk'\n"},
			wantContains: []string{"schema compile failed", "Cannot find module '@peretyn/sdk'"},
			wantAbsent:   []string{`"type": "module"`},
		},
		{
			name:         "a silent failure still names the exit code",
			failure:      compileFailure{exitCode: 3},
			wantContains: []string{"schema compile failed", "exit status 3"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := explainCompileFailure(tt.failure).Error()
			for _, want := range tt.wantContains {
				if !strings.Contains(got, want) {
					t.Errorf("explainCompileFailure() = %q, want it to contain %q", got, want)
				}
			}
			for _, absent := range tt.wantAbsent {
				if strings.Contains(got, absent) {
					t.Errorf("explainCompileFailure() = %q, want it not to contain %q", got, absent)
				}
			}
		})
	}
}
