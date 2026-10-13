package fga

import (
	"context"
	"fmt"
	"time"

	openfgalogger "github.com/openfga/openfga/pkg/logger"
	"github.com/openfga/openfga/pkg/server"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/postgres"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"
	"go.uber.org/zap"
)

const (
	maxOpenConns               = 20
	maxConcurrentReadsForCheck = maxOpenConns / 2
	maxConcurrentReadsForList  = maxOpenConns / 4
	maxIdleConns               = 5
	maxTuplesPerWrite          = 100
	maxTypesPerModel           = 100
	listObjectsMaxResults      = 1000
	listObjectsDeadline        = 3 * time.Second
	connMaxIdleTime            = 10 * time.Minute
	pingTimeout                = 10 * time.Second
)

type Config struct {
	Datastore storage.OpenFGADatastore
	Logger    *zap.Logger
}

func New(ctx context.Context, cfg Config) (*server.Server, func(), error) {
	logger := &openfgalogger.ZapLogger{Logger: cfg.Logger}

	opts := []server.OpenFGAServiceV1Option{
		server.WithDatastore(cfg.Datastore),
		server.WithContext(ctx),
		server.WithLogger(logger),
		server.WithListObjectsDeadline(listObjectsDeadline),
		server.WithListObjectsMaxResults(listObjectsMaxResults),
		server.WithMaxConcurrentReadsForCheck(maxConcurrentReadsForCheck),
		server.WithMaxConcurrentReadsForListObjects(maxConcurrentReadsForList),
		server.WithMaxConcurrentReadsForListUsers(maxConcurrentReadsForList),
		server.WithDispatchThrottlingCheckResolverEnabled(true),
		server.WithListObjectsDispatchThrottlingEnabled(true),
		server.WithListUsersDispatchThrottlingEnabled(true),
	}

	srv, err := server.NewServerWithOpts(opts...)
	if err != nil {
		cfg.Datastore.Close()
		return nil, nil, fmt.Errorf("openfga: NewServerWithOpts: %w", err)
	}

	closer := func() {
		srv.Close()
		cfg.Datastore.Close()
	}
	return srv, closer, nil
}

func NewPostgresDatastore(uri string, logger *zap.Logger) (storage.OpenFGADatastore, error) {
	ds, err := postgres.New(uri, DatastoreSettings(logger))
	if err != nil {
		return nil, fmt.Errorf("postgres datastore: %w", err)
	}
	return ds, nil
}

func DatastoreSettings(logger *zap.Logger) *sqlcommon.Config {
	return &sqlcommon.Config{
		Logger:                 &openfgalogger.ZapLogger{Logger: logger},
		MaxTuplesPerWriteField: maxTuplesPerWrite,
		MaxTypesPerModelField:  maxTypesPerModel,
		MaxOpenConns:           maxOpenConns,
		MaxIdleConns:           maxIdleConns,
		ConnMaxIdleTime:        connMaxIdleTime,
		ConnMaxLifetime:        time.Hour,
		PingTimeout:            pingTimeout,
	}
}
