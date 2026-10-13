//go:build integration

package storage

import (
	"context"
	"os"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // registers "pgx" driver for OpenFGA migrate
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

var integrationDSN string

func TestMain(m *testing.M) {
	ctx := context.Background()
	ctr, err := tcpostgres.Run(ctx, "postgres:16-alpine",
		tcpostgres.WithDatabase("peretyn_test"),
		tcpostgres.WithUsername("postgres"),
		tcpostgres.WithPassword("postgres"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		panic("start postgres container: " + err.Error())
	}

	dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = ctr.Terminate(ctx)
		panic("get connection string: " + err.Error())
	}
	integrationDSN = dsn

	os.Exit(run(m, ctr))
}

func run(m *testing.M, ctr *tcpostgres.PostgresContainer) int {
	defer func() { _ = ctr.Terminate(context.Background()) }()
	return m.Run()
}

func TestConnect_CreatesTheSchema(t *testing.T) {
	ctx := context.Background()
	pool, err := Connect(ctx, integrationDSN, "peretyn_runtime")
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer pool.Close()

	var count int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM information_schema.tables
		WHERE table_schema = 'peretyn_runtime' AND table_name = 'api_key'`,
	).Scan(&count); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Errorf("expected api_key table to exist, got count=%d", count)
	}

	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM pg_indexes
		WHERE schemaname = 'peretyn_runtime' AND indexname = 'api_key_hash_idx'`,
	).Scan(&count); err != nil {
		t.Fatalf("index query: %v", err)
	}
	if count != 1 {
		t.Error("expected api_key_hash_idx to exist")
	}
}

func TestConnect_Idempotent(t *testing.T) {
	ctx := context.Background()
	for i := range 3 {
		pool, err := Connect(ctx, integrationDSN, "peretyn_runtime")
		if err != nil {
			t.Fatalf("call %d: %v", i+1, err)
		}
		pool.Close()
	}
}

func TestRunMigrations_Postgres(t *testing.T) {
	pool, err := Connect(context.Background(), integrationDSN, "peretyn_runtime")
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	pool.Close()
	if err := RunMigrations(integrationDSN + "&search_path=%22peretyn_runtime%22"); err != nil {
		t.Fatalf("RunMigrations(postgres): %v", err)
	}
}
