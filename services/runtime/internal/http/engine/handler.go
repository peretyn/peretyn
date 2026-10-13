package engine

import (
	"net/http"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/server"
	"github.com/peretyn/peretyn/services/runtime/internal/http/auth"
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
	mux.HandleFunc("POST /v1/check", requireToken(respond.Engine(respond.Operation{Logger: deps.Logger, Name: "Check"}, auth.StoreID, fga.Check)))
	mux.HandleFunc("POST /v1/batch-check", requireToken(respond.Engine(respond.Operation{Logger: deps.Logger, Name: "BatchCheck"}, auth.StoreID, fga.BatchCheck)))
	mux.HandleFunc("POST /v1/write", requireToken(respond.Engine(respond.Operation{Logger: deps.Logger, Name: "Write"}, auth.StoreID, fga.Write)))
	mux.HandleFunc("POST /v1/expand", requireToken(respond.Engine(respond.Operation{Logger: deps.Logger, Name: "Expand"}, auth.StoreID, fga.Expand)))
	mux.HandleFunc("POST /v1/list-objects", requireToken(respond.Engine(respond.Operation{Logger: deps.Logger, Name: "ListObjects"}, auth.StoreID, fga.ListObjects)))
	mux.HandleFunc("POST /v1/list-users", requireToken(respond.Engine(respond.Operation{Logger: deps.Logger, Name: "ListUsers"}, auth.StoreID, fga.ListUsers)))
	mux.HandleFunc("GET /v1/changes", requireToken(func(w http.ResponseWriter, r *http.Request) {
		resp, err := fga.ReadChanges(r.Context(), &openfgav1.ReadChangesRequest{
			StoreId:           auth.StoreID(r),
			Type:              r.URL.Query().Get("type"),
			ContinuationToken: r.URL.Query().Get("continuation_token"),
		})
		if err != nil {
			respond.EngineError(w, r, respond.FailureDetails{Operation: respond.Operation{Logger: deps.Logger, Name: "ReadChanges"}, Err: err})
			return
		}
		respond.Proto(w, http.StatusOK, resp)
	}))
}
