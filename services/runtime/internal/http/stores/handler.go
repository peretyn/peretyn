package stores

import (
	"net/http"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/server"
	"github.com/peretyn/peretyn/services/runtime/internal/http/respond"
	"go.uber.org/zap"
)

type handler struct {
	fga    *server.Server
	logger *zap.Logger
}

type Deps struct {
	RequireInternal func(http.HandlerFunc) http.HandlerFunc
	FGA             *server.Server
	Logger          *zap.Logger
}

func Routes(mux *http.ServeMux, deps Deps) {
	requireInternal := deps.RequireInternal
	h := &handler{fga: deps.FGA, logger: deps.Logger}
	mux.HandleFunc("POST /v1/stores", requireInternal(h.create))
	mux.HandleFunc("DELETE /v1/stores/{id}", requireInternal(h.delete))
	mux.HandleFunc("POST /v1/stores/{id}/authorization-models", requireInternal(h.writeAuthModel))
}

func (h *handler) create(w http.ResponseWriter, r *http.Request) {
	var req openfgav1.CreateStoreRequest
	if !respond.DecodeProto(w, r, &req) {
		return
	}
	resp, err := h.fga.CreateStore(r.Context(), &req)
	if err != nil {
		respond.EngineError(w, r, respond.FailureDetails{Operation: respond.Operation{Logger: h.logger, Name: "CreateStore"}, Err: err})
		return
	}
	respond.Proto(w, http.StatusCreated, resp)
}

func (h *handler) delete(w http.ResponseWriter, r *http.Request) {
	_, err := h.fga.DeleteStore(r.Context(), &openfgav1.DeleteStoreRequest{StoreId: r.PathValue("id")})
	if err != nil {
		respond.EngineError(w, r, respond.FailureDetails{Operation: respond.Operation{Logger: h.logger, Name: "DeleteStore"}, Err: err})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) writeAuthModel(w http.ResponseWriter, r *http.Request) {
	storeID := r.PathValue("id")
	var req openfgav1.WriteAuthorizationModelRequest
	if !respond.DecodeProto(w, r, &req) {
		return
	}
	req.StoreId = storeID
	resp, err := h.fga.WriteAuthorizationModel(r.Context(), &req)
	if err != nil {
		respond.EngineError(w, r, respond.FailureDetails{Operation: respond.Operation{Logger: h.logger, Name: "WriteAuthorizationModel"}, Err: err})
		return
	}
	respond.Proto(w, http.StatusCreated, resp)
}
