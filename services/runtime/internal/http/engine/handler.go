package engine

import (
	"net/http"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/server"
	"github.com/peretyn/peretyn/services/runtime/internal/http/auth"
	"github.com/peretyn/peretyn/services/runtime/internal/http/explain"
	"github.com/peretyn/peretyn/services/runtime/internal/http/respond"
	"go.uber.org/zap"
)

type Deps struct {
	RequireToken func(http.HandlerFunc) http.HandlerFunc
	FGA          *server.Server
	Logger       *zap.Logger
}

func Routes(mux *http.ServeMux, deps Deps) {
	requireToken, fga := deps.RequireToken, deps.FGA
	operation := func(name string) respond.Operation {
		return respond.Operation{Logger: deps.Logger, Name: name, Explainer: explain.New(fga)}
	}
	mux.HandleFunc("POST /v1/check", requireToken(respond.Engine(operation("Check"), auth.StoreID, fga.Check)))
	mux.HandleFunc("POST /v1/batch-check", requireToken(respond.Engine(operation("BatchCheck"), auth.StoreID, fga.BatchCheck)))
	mux.HandleFunc("POST /v1/write", requireToken(respond.Engine(operation("Write"), auth.StoreID, fga.Write)))
	mux.HandleFunc("POST /v1/expand", requireToken(respond.Engine(operation("Expand"), auth.StoreID, fga.Expand)))
	mux.HandleFunc("POST /v1/list-objects", requireToken(respond.Engine(operation("ListObjects"), auth.StoreID, fga.ListObjects)))
	mux.HandleFunc("POST /v1/list-users", requireToken(respond.Engine(operation("ListUsers"), auth.StoreID, fga.ListUsers)))
	mux.HandleFunc("GET /v1/changes", requireToken(func(w http.ResponseWriter, r *http.Request) {
		resp, err := fga.ReadChanges(r.Context(), &openfgav1.ReadChangesRequest{
			StoreId:           auth.StoreID(r),
			Type:              r.URL.Query().Get("type"),
			ContinuationToken: r.URL.Query().Get("continuation_token"),
		})
		if err != nil {
			respond.EngineError(w, r, respond.FailureDetails{Operation: operation("ReadChanges"), Err: err, StoreID: auth.StoreID(r)})
			return
		}
		respond.Proto(w, http.StatusOK, resp)
	}))
}
