package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openfga/openfga/pkg/server"
	"go.uber.org/zap"

	"github.com/peretyn/peretyn/services/runtime/internal/config"
	"github.com/peretyn/peretyn/services/runtime/internal/fga"
	peretynhttp "github.com/peretyn/peretyn/services/runtime/internal/http"
	"github.com/peretyn/peretyn/services/runtime/internal/http/keys"
	"github.com/peretyn/peretyn/services/runtime/internal/logger"
	"github.com/peretyn/peretyn/services/runtime/internal/storage"
)

var version = "dev"

const (
	readHeaderTimeout      = 5 * time.Second
	readTimeout            = 15 * time.Second
	idleTimeout            = 60 * time.Second
	shutdownTimeout        = 10 * time.Second
	internalRequestTimeout = config.WriteTimeout - 5*time.Second
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "peretyn-runtime: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, log, err := loadConfigAndLogger()
	if err != nil {
		return err
	}
	defer func() { _ = log.Sync() }()

	logStartup(log, cfg)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	pool, err := connectPool(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	fgaServer, closeFGA, err := startOpenFGA(ctx, log, cfg)
	if err != nil {
		return err
	}
	defer closeFGA()

	keyStore := keys.NewStore(keys.NewPostgresRepository(pool, cfg.DatabaseSchema), cfg.KeyPrefix)
	warmKeyStore(ctx, log, keyStore)

	deps := peretynhttp.Deps{
		FGA:                    fgaServer,
		Logger:                 log,
		Keys:                   keyStore,
		InternalSecret:         cfg.InternalSecret,
		RequestTimeout:         cfg.RequestTimeout,
		InternalRequestTimeout: internalRequestTimeout,
	}

	return serve(ctx, log, newServers(cfg, deps)...)
}

func loadConfigAndLogger() (config.Config, *zap.Logger, error) {
	cfg, err := config.Load()
	if err != nil {
		return cfg, nil, fmt.Errorf("load config: %w", err)
	}
	log, err := logger.Init(cfg.LogLevel)
	if err != nil {
		return cfg, nil, fmt.Errorf("init logger: %w", err)
	}
	return cfg, log, nil
}

func warmKeyStore(ctx context.Context, log *zap.Logger, keyStore *keys.Store) {
	if err := keyStore.WarmFromDB(ctx); err != nil {
		log.Warn("key cache warm failed; runtime will hydrate on first request", zap.Error(err))
	}
}

func newServers(cfg config.Config, deps peretynhttp.Deps) []*http.Server {
	return []*http.Server{
		newServer(cfg.HTTPAddr, peretynhttp.NewPublicHandler(deps)),
		newServer(cfg.InternalAddr, peretynhttp.NewInternalHandler(deps)),
	}
}

func logStartup(log *zap.Logger, cfg config.Config) {
	log.Info("peretyn-runtime starting",
		zap.String("version", version),
		zap.String("addr", cfg.HTTPAddr),
		zap.String("schema", cfg.DatabaseSchema),
	)
}

func connectPool(ctx context.Context, cfg config.Config) (*pgxpool.Pool, error) {
	pool, err := storage.Connect(ctx, cfg.DatabaseURL, cfg.DatabaseSchema)
	if err != nil {
		return nil, fmt.Errorf("connect db: %w", err)
	}
	return pool, nil
}

func startOpenFGA(ctx context.Context, log *zap.Logger, cfg config.Config) (*server.Server, func(), error) {
	if err := storage.RunMigrations(cfg.DatastoreURI); err != nil {
		return nil, nil, fmt.Errorf("run migrations: %w", err)
	}
	datastore, err := fga.NewPostgresDatastore(cfg.DatastoreURI, log)
	if err != nil {
		return nil, nil, fmt.Errorf("init openfga datastore: %w", err)
	}
	fgaServer, closeFGA, err := fga.New(ctx, fga.Config{Datastore: datastore, Logger: log})
	if err != nil {
		return nil, nil, fmt.Errorf("init openfga: %w", err)
	}
	return fgaServer, closeFGA, nil
}

func newServer(addr string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      config.WriteTimeout,
		IdleTimeout:       idleTimeout,
	}
}

func serve(ctx context.Context, log *zap.Logger, servers ...*http.Server) error {
	errc := make(chan error, len(servers))
	for _, srv := range servers {
		go func() {
			log.Info("listening", zap.String("addr", srv.Addr))
			errc <- srv.ListenAndServe()
		}()
	}

	var listenErr error
	select {
	case <-ctx.Done():
		log.Info("shutdown requested")
	case err := <-errc:
		listenErr = fmt.Errorf("listen: %w", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer shutdownCancel()
	var wg sync.WaitGroup
	for _, srv := range servers {
		wg.Go(func() {
			if err := srv.Shutdown(shutdownCtx); err != nil {
				log.Error("graceful shutdown failed", zap.String("addr", srv.Addr), zap.Error(err))
			}
		})
	}
	wg.Wait()
	return listenErr
}
