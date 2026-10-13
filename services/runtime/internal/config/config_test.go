package config

import (
	"testing"

	"go.uber.org/zap/zapcore"
)

func setRequired(t *testing.T) {
	t.Helper()
	for k, v := range map[string]string{
		"PERETYN_RUNTIME_ADDR":         "",
		"PERETYN_RUNTIME_SCHEMA":       "",
		"PERETYN_LOG_LEVEL":            "",
		"PERETYN_KEY_PREFIX":           "",
		"PERETYN_REQUEST_TIMEOUT":      "",
		"PERETYN_RUNTIME_DATABASE_URL": "postgres://h/db",
		"PERETYN_INTERNAL_SECRET":      "secret",
	} {
		t.Setenv(k, v)
	}
}

func TestLoadDefaults(t *testing.T) {
	setRequired(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Errorf("HTTPAddr = %q, want %q", cfg.HTTPAddr, ":8080")
	}
	if cfg.DatabaseSchema != "peretyn_runtime" {
		t.Errorf("DatabaseSchema = %q, want %q", cfg.DatabaseSchema, "peretyn_runtime")
	}
	if cfg.LogLevel != zapcore.InfoLevel {
		t.Errorf("LogLevel = %v, want info", cfg.LogLevel)
	}
	if cfg.KeyPrefix != "prn_" {
		t.Errorf("KeyPrefix = %q, want %q", cfg.KeyPrefix, "prn_")
	}
	if cfg.InternalSecret != "secret" {
		t.Errorf("InternalSecret = %q, want %q", cfg.InternalSecret, "secret")
	}
}

func TestLoadReadsOverrides(t *testing.T) {
	setRequired(t)
	t.Setenv("PERETYN_LOG_LEVEL", "debug")
	t.Setenv("PERETYN_KEY_PREFIX", "acme_")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.LogLevel != zapcore.DebugLevel {
		t.Errorf("LogLevel = %v, want debug", cfg.LogLevel)
	}
	if cfg.KeyPrefix != "acme_" {
		t.Errorf("KeyPrefix = %q, want %q", cfg.KeyPrefix, "acme_")
	}
}

func TestLoadRejectsInvalidSettings(t *testing.T) {
	for _, tc := range []struct{ key, value string }{
		{"PERETYN_RUNTIME_DATABASE_URL", ""},
		{"PERETYN_INTERNAL_SECRET", ""},
		{"PERETYN_LOG_LEVEL", "loud"},
		{"PERETYN_REQUEST_TIMEOUT", "soon"},
		{"PERETYN_REQUEST_TIMEOUT", "0s"},
		{"PERETYN_REQUEST_TIMEOUT", "-1s"},
		{"PERETYN_REQUEST_TIMEOUT", "30s"},
	} {
		t.Run(tc.key+"="+tc.value, func(t *testing.T) {
			setRequired(t)
			t.Setenv(tc.key, tc.value)
			if _, err := Load(); err == nil {
				t.Fatalf("expected an error for %s=%q", tc.key, tc.value)
			}
		})
	}
}

func TestLoadIgnoresTheRemovedDatastoreSetting(t *testing.T) {
	setRequired(t)
	t.Setenv("PERETYN_DATASTORE", "sqlite")
	t.Setenv("PERETYN_RUNTIME_DATABASE_URL", "postgres://h/db")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := `postgres://h/db?search_path=%22peretyn_runtime%22`
	if cfg.DatastoreURI != want {
		t.Errorf("DatastoreURI = %q, want the Postgres URI %q", cfg.DatastoreURI, want)
	}
}

func TestLoadPinsTheDatastoreSearchPath(t *testing.T) {
	for _, tc := range []struct {
		name, url, schema, want string
	}{
		{"the schema is pinned", "postgres://h/db", "peretyn_runtime", `postgres://h/db?search_path=%22peretyn_runtime%22`},
		{"existing query string is preserved", "postgres://h/db?sslmode=disable", "peretyn_runtime", `postgres://h/db?search_path=%22peretyn_runtime%22&sslmode=disable`},
		{"explicit search_path wins", "postgres://h/db?search_path=custom", "peretyn_runtime", "postgres://h/db?search_path=custom"},
		{"a custom schema is honoured", "postgres://h/db", "other", `postgres://h/db?search_path=%22other%22`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setRequired(t)
			t.Setenv("PERETYN_RUNTIME_DATABASE_URL", tc.url)
			t.Setenv("PERETYN_RUNTIME_SCHEMA", tc.schema)

			cfg, err := Load()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if cfg.DatastoreURI != tc.want {
				t.Errorf("DatastoreURI = %q, want %q", cfg.DatastoreURI, tc.want)
			}
		})
	}
}
