package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"go.uber.org/zap/zapcore"
)

const WriteTimeout = 30 * time.Second

type Config struct {
	HTTPAddr       string
	InternalAddr   string
	DatabaseURL    string
	DatabaseSchema string
	DatastoreURI   string
	LogLevel       zapcore.Level
	InternalSecret string
	KeyPrefix      string
	RequestTimeout time.Duration
}

var (
	errRequestTimeoutOutOfRange = errors.New("PERETYN_REQUEST_TIMEOUT must be above 0 and below")
	errInternalSecretMissing    = errors.New("PERETYN_INTERNAL_SECRET is required")
	errDatabaseURLMissing       = errors.New("PERETYN_RUNTIME_DATABASE_URL is required")
)

func Load() (Config, error) {
	cfg := Config{
		HTTPAddr:       readEnvWithFallback("PERETYN_RUNTIME_ADDR", ":8080"),
		InternalAddr:   readEnvWithFallback("PERETYN_RUNTIME_INTERNAL_ADDR", ":8081"),
		DatabaseURL:    os.Getenv("PERETYN_RUNTIME_DATABASE_URL"),
		DatabaseSchema: readEnvWithFallback("PERETYN_RUNTIME_SCHEMA", "peretyn_runtime"),
		InternalSecret: os.Getenv("PERETYN_INTERNAL_SECRET"),
		KeyPrefix:      readEnvWithFallback("PERETYN_KEY_PREFIX", "prn_"),
	}

	level, err := zapcore.ParseLevel(readEnvWithFallback("PERETYN_LOG_LEVEL", "info"))
	if err != nil {
		return cfg, fmt.Errorf("PERETYN_LOG_LEVEL: %w", err)
	}
	cfg.LogLevel = level

	if cfg.RequestTimeout, err = parseRequestTimeout(); err != nil {
		return cfg, err
	}
	if err := requireCredentials(cfg); err != nil {
		return cfg, err
	}
	if cfg.DatastoreURI, err = resolvePostgresURI(cfg); err != nil {
		return cfg, err
	}
	return cfg, nil
}

func parseRequestTimeout() (time.Duration, error) {
	timeout, err := time.ParseDuration(readEnvWithFallback("PERETYN_REQUEST_TIMEOUT", "5s"))
	if err != nil {
		return timeout, fmt.Errorf("PERETYN_REQUEST_TIMEOUT: %w", err)
	}
	if timeout <= 0 || timeout >= WriteTimeout {
		return timeout, fmt.Errorf("%w %s, got %s", errRequestTimeoutOutOfRange, WriteTimeout, timeout)
	}
	return timeout, nil
}

func requireCredentials(cfg Config) error {
	if cfg.InternalSecret == "" {
		return errInternalSecretMissing
	}
	if cfg.DatabaseURL == "" {
		return errDatabaseURLMissing
	}
	return nil
}

func resolvePostgresURI(cfg Config) (string, error) {
	u, err := url.Parse(cfg.DatabaseURL)
	if err != nil {
		return "", fmt.Errorf("PERETYN_RUNTIME_DATABASE_URL: %w", withoutURL(err))
	}
	q := u.Query()
	if !q.Has("search_path") {
		q.Set("search_path", pgx.Identifier{cfg.DatabaseSchema}.Sanitize())
		u.RawQuery = q.Encode()
	}
	return u.String(), nil
}

func withoutURL(err error) error {
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return urlErr.Err
	}
	return err
}

func readEnvWithFallback(key string, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
