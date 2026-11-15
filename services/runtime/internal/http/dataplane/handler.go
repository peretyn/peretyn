package dataplane

import (
	"net/http"

	"github.com/openfga/openfga/pkg/server"
	"github.com/peretyn/peretyn/services/runtime/internal/http/explain"
	"github.com/peretyn/peretyn/services/runtime/internal/http/respond"
	"go.uber.org/zap"
)

type Deps struct {
	RequireInternal func(http.HandlerFunc) http.HandlerFunc
	FGA             *server.Server
	Logger          *zap.Logger
}

func Routes(mux *http.ServeMux, deps Deps) {
	requireInternal, fga := deps.RequireInternal, deps.FGA
	storeID := func(r *http.Request) string { return r.PathValue("id") }
	operation := func(name string) respond.Operation {
		return respond.Operation{Logger: deps.Logger, Name: name, Explainer: explain.New(fga)}
	}
	mux.HandleFunc("POST /v1/internal/stores/{id}/check", requireInternal(respond.Engine(operation("check"), storeID, fga.Check)))
	mux.HandleFunc("POST /v1/internal/stores/{id}/read", requireInternal(respond.Engine(operation("read"), storeID, fga.Read)))
	mux.HandleFunc("POST /v1/internal/stores/{id}/write", requireInternal(respond.Engine(operation("write"), storeID, fga.Write)))
	mux.HandleFunc("POST /v1/internal/stores/{id}/expand", requireInternal(respond.Engine(operation("expand"), storeID, fga.Expand)))
}
