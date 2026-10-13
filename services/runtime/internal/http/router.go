package http

import (
	"net/http"
	"time"

	"github.com/openfga/openfga/pkg/server"
	"github.com/peretyn/peretyn/services/runtime/internal/http/auth"
	"github.com/peretyn/peretyn/services/runtime/internal/http/dataplane"
	"github.com/peretyn/peretyn/services/runtime/internal/http/engine"
	"github.com/peretyn/peretyn/services/runtime/internal/http/keys"
	"github.com/peretyn/peretyn/services/runtime/internal/http/respond"
	"github.com/peretyn/peretyn/services/runtime/internal/http/stores"
	"go.uber.org/zap"
)

type Deps struct {
	FGA                    *server.Server
	Logger                 *zap.Logger
	Keys                   *keys.Store
	InternalSecret         string
	RequestTimeout         time.Duration
	InternalRequestTimeout time.Duration
}

func health(w http.ResponseWriter, _ *http.Request) {
	respond.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func NewPublicHandler(deps Deps) http.Handler {
	mux := http.NewServeMux()
	requireToken := auth.RequireToken(deps.Logger, deps.Keys)

	mux.HandleFunc("GET /healthz", health)
	auth.Routes(mux, requireToken)
	engine.Routes(mux, engine.Deps{RequireToken: requireToken, FGA: deps.FGA, Logger: deps.Logger})

	return respond.Logging(deps.Logger, respond.WithTimeout(deps.RequestTimeout, mux))
}

func NewInternalHandler(deps Deps) http.Handler {
	mux := http.NewServeMux()
	requireToken := auth.RequireToken(deps.Logger, deps.Keys)
	requireInternal := auth.RequireInternal(deps.InternalSecret)

	mux.HandleFunc("GET /healthz", health)
	auth.Routes(mux, requireToken)
	keys.Routes(mux, keys.Deps{RequireInternal: requireInternal, Store: deps.Keys, Logger: deps.Logger})
	stores.Routes(mux, stores.Deps{RequireInternal: requireInternal, FGA: deps.FGA, Logger: deps.Logger})
	dataplane.Routes(mux, dataplane.Deps{RequireInternal: requireInternal, FGA: deps.FGA, Logger: deps.Logger})

	return respond.Logging(deps.Logger, respond.WithTimeout(deps.InternalRequestTimeout, mux))
}
