//go:build integration

package keys

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/peretyn/peretyn/services/runtime/internal/storage"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

const testPrefix = "prn_"

var integrationPool *pgxpool.Pool

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
		panic("start postgres: " + err.Error())
	}

	dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = ctr.Terminate(ctx)
		panic("connection string: " + err.Error())
	}

	pool, err := storage.Connect(ctx, dsn, "peretyn_runtime")
	if err != nil {
		_ = ctr.Terminate(ctx)
		panic("storage.Connect: " + err.Error())
	}
	integrationPool = pool

	os.Exit(run(m, pool, ctr))
}

func run(m *testing.M, pool *pgxpool.Pool, ctr *tcpostgres.PostgresContainer) int {
	defer pool.Close()
	defer func() { _ = ctr.Terminate(context.Background()) }()
	return m.Run()
}

func clearCache(s *Store) {
	s.mu.Lock()
	s.byHash = make(map[string]storeEntry)
	s.mu.Unlock()
}

func pgEnv() string { return uuid.New().String() }

func TestStorePostgres_CreateThenLookup(t *testing.T) {
	ctx := context.Background()
	s := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	envUUID := pgEnv()

	key, err := s.Create(ctx, CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "store-pg-1",
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = s.Delete(ctx, envUUID) })

	tc, ok, _ := s.Lookup(ctx, key.Plaintext)
	require.True(t, ok)
	require.Equal(t, "store-pg-1", tc.StoreID)
	require.Equal(t, "dev", tc.Environment)
}

func TestStorePostgres_LookupDBFallback(t *testing.T) {
	ctx := context.Background()
	s := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	envUUID := pgEnv()

	key, err := s.Create(ctx, CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "store-pg-2",
		ProjectSlug:     "proj",
		EnvironmentName: "staging",
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = s.Delete(ctx, envUUID) })

	clearCache(s)

	tc, ok, _ := s.Lookup(ctx, key.Plaintext)
	require.True(t, ok, "lookup should fall back to DB after cache cleared")
	require.Equal(t, "store-pg-2", tc.StoreID)
	require.Equal(t, "staging", tc.Environment)
}

func TestStorePostgres_WarmFromDB(t *testing.T) {
	ctx := context.Background()
	s1 := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	envUUID := pgEnv()

	key, err := s1.Create(ctx, CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "store-pg-3",
		ProjectSlug:     "proj",
		EnvironmentName: "prod",
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = s1.Delete(ctx, envUUID) })

	s2 := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	require.NoError(t, s2.WarmFromDB(ctx))

	tc, ok, _ := s2.Lookup(ctx, key.Plaintext)
	require.True(t, ok, "lookup should succeed after WarmFromDB")
	require.Equal(t, "store-pg-3", tc.StoreID)
	require.Equal(t, "prod", tc.Environment)
}

func TestStorePostgres_Rotate(t *testing.T) {
	ctx := context.Background()
	s := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	envUUID := pgEnv()

	old, err := s.Create(ctx, CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "store-pg-4",
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = s.Delete(ctx, envUUID) })

	rotated, err := s.Rotate(ctx, envUUID)
	require.NoError(t, err)
	require.NotEqual(t, old.Plaintext, rotated.Plaintext)

	_, ok, _ := s.Lookup(ctx, old.Plaintext)
	require.False(t, ok, "old token must be invalid after rotate")

	tc, ok, _ := s.Lookup(ctx, rotated.Plaintext)
	require.True(t, ok, "new token must be valid")
	require.Equal(t, "store-pg-4", tc.StoreID)
}

func TestStorePostgres_RotateNotInCache(t *testing.T) {
	ctx := context.Background()
	s := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	envUUID := pgEnv()

	_, err := s.Create(ctx, CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "store-pg-5",
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = s.Delete(ctx, envUUID) })

	clearCache(s)

	rotated, err := s.Rotate(ctx, envUUID)
	require.NoError(t, err, "rotate should succeed via DB lookup when not cached")

	clearCache(s)
	tc, ok, _ := s.Lookup(ctx, rotated.Plaintext)
	require.True(t, ok)
	require.Equal(t, "store-pg-5", tc.StoreID)
}

func TestStorePostgres_Delete(t *testing.T) {
	ctx := context.Background()
	s := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	envUUID := pgEnv()

	key, err := s.Create(ctx, CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "store-pg-6",
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})
	require.NoError(t, err)

	require.NoError(t, s.Delete(ctx, envUUID))

	_, ok, _ := s.Lookup(ctx, key.Plaintext)
	require.False(t, ok, "token must be invalid after delete")

	var count int
	err = integrationPool.QueryRow(ctx,
		`SELECT COUNT(*) FROM peretyn_runtime.api_key WHERE environment_uuid = $1`, envUUID,
	).Scan(&count)
	require.NoError(t, err)
	require.Equal(t, 0, count, "DB row must be gone after delete")
}

func TestStorePostgres_DeleteEvictsAKeyAnotherReplicaRotated(t *testing.T) {
	ctx := context.Background()
	writer := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	replica := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	envUUID := pgEnv()

	old, err := writer.Create(ctx, CreateReq{
		EnvironmentUUID: envUUID,
		StoreID:         "store-pg-8",
		ProjectSlug:     "proj",
		EnvironmentName: "dev",
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = writer.Delete(ctx, envUUID) })

	_, ok, err := replica.Lookup(ctx, old.Plaintext)
	require.NoError(t, err)
	require.True(t, ok)

	rotated, err := writer.Rotate(ctx, envUUID)
	require.NoError(t, err)
	_, ok, err = replica.Lookup(ctx, rotated.Plaintext)
	require.NoError(t, err)
	require.True(t, ok)

	require.NoError(t, replica.Delete(ctx, envUUID))
	_, ok, err = replica.Lookup(ctx, rotated.Plaintext)
	require.NoError(t, err)
	require.False(t, ok, "the replica that deleted the key must stop honouring it")
}

func TestStorePostgres_CreateTwiceConflicts(t *testing.T) {
	ctx := context.Background()
	s := NewStore(NewPostgresRepository(integrationPool, "peretyn_runtime"), testPrefix)
	req := CreateReq{EnvironmentUUID: pgEnv(), StoreID: "store-pg-9", ProjectSlug: "proj", EnvironmentName: "dev"}

	_, err := s.Create(ctx, req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = s.Delete(ctx, req.EnvironmentUUID) })

	_, err = s.Create(ctx, req)
	require.ErrorIs(t, err, ErrExists)
}
