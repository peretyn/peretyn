package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	openfgalogger "github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/storage/migrate"
)

const (
	migrationTimeout     = 2 * time.Minute
	migrationPingTimeout = 10 * time.Second
)

func Connect(ctx context.Context, dsn, schema string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("open db pool: %w", err)
	}
	_, err = pool.Exec(ctx, fmt.Sprintf(`
		CREATE SCHEMA IF NOT EXISTS %[1]s;
		CREATE TABLE IF NOT EXISTS %[1]s.api_key (
			id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			environment_uuid UUID NOT NULL UNIQUE,
			openfga_store_id TEXT NOT NULL,
			project_slug     TEXT NOT NULL,
			environment_name TEXT NOT NULL,
			key_hash         TEXT NOT NULL,
			key_prefix       TEXT NOT NULL,
			key_last4        TEXT NOT NULL,
			created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			rotated_at       TIMESTAMPTZ
		);
		CREATE UNIQUE INDEX IF NOT EXISTS api_key_hash_idx ON %[1]s.api_key(key_hash)`,
		pgx.Identifier{schema}.Sanitize()))
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("ensure %s schema: %w", schema, err)
	}
	return pool, nil
}

func RunMigrations(uri string) error {
	err := migrate.RunMigrations(migrate.MigrationConfig{
		Engine:      "postgres",
		URI:         uri,
		Timeout:     migrationTimeout,
		PingTimeout: migrationPingTimeout,
		Logger:      openfgalogger.NewNoopLogger(),
	})
	if err != nil {
		return fmt.Errorf("migrate openfga schema: %w", err)
	}
	return nil
}
