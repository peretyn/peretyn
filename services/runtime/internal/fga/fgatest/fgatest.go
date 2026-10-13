package fgatest

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	openfgalogger "github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/server"
	"github.com/openfga/openfga/pkg/storage/migrate"
	"github.com/openfga/openfga/pkg/storage/sqlite"
	"github.com/peretyn/peretyn/services/runtime/internal/fga"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

const (
	migrationTimeout     = time.Minute
	migrationPingTimeout = 10 * time.Second
)

func NewServer(t testing.TB) *server.Server {
	t.Helper()
	uri := filepath.Join(t.TempDir(), "fga.db")
	require.NoError(t, migrate.RunMigrations(migrate.MigrationConfig{
		Engine:      "sqlite",
		URI:         uri,
		Timeout:     migrationTimeout,
		PingTimeout: migrationPingTimeout,
		Logger:      openfgalogger.NewNoopLogger(),
	}))

	ds, err := sqlite.New(uri, fga.DatastoreSettings(zap.NewNop()))
	require.NoError(t, err)
	srv, closeFGA, err := fga.New(context.Background(), fga.Config{Datastore: ds, Logger: zap.NewNop()})
	require.NoError(t, err)
	t.Cleanup(closeFGA)
	return srv
}
