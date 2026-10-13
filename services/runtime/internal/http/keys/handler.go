package keys

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/peretyn/peretyn/services/runtime/internal/http/respond"
	"go.uber.org/zap"
)

type handler struct {
	store  *Store
	logger *zap.Logger
}

type Deps struct {
	RequireInternal func(http.HandlerFunc) http.HandlerFunc
	Store           *Store
	Logger          *zap.Logger
}

func Routes(mux *http.ServeMux, deps Deps) {
	requireInternal := deps.RequireInternal
	h := &handler{store: deps.Store, logger: deps.Logger}
	mux.HandleFunc("POST /v1/internal/keys", requireInternal(h.create))
	mux.HandleFunc("POST /v1/internal/keys/{env_uuid}/rotate", requireInternal(h.rotate))
	mux.HandleFunc("DELETE /v1/internal/keys/{env_uuid}", requireInternal(h.delete))
}

func (h *handler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateReq
	if !respond.DecodeJSON(w, r, &req) {
		return
	}
	if req.EnvironmentUUID == "" || req.StoreID == "" || req.ProjectSlug == "" || req.EnvironmentName == "" {
		respond.Error(w, http.StatusBadRequest, "environmentUuid, storeId, projectSlug, environmentName are required")
		return
	}
	envUUID, ok := parseEnvUUID(w, req.EnvironmentUUID)
	if !ok {
		return
	}
	req.EnvironmentUUID = envUUID

	key, err := h.store.Create(r.Context(), req)
	if errors.Is(err, ErrExists) {
		respond.Error(w, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		respond.Failure(w, r, respond.FailureDetails{Operation: respond.Operation{Logger: h.logger, Name: "keys.create"}, StatusCode: http.StatusInternalServerError, Err: err})
		return
	}
	respond.JSON(w, http.StatusCreated, key)
}

func (h *handler) rotate(w http.ResponseWriter, r *http.Request) {
	envUUID, ok := parseEnvUUID(w, r.PathValue("env_uuid"))
	if !ok {
		return
	}
	key, err := h.store.Rotate(r.Context(), envUUID)
	if errors.Is(err, ErrNotFound) {
		respond.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		respond.Failure(w, r, respond.FailureDetails{Operation: respond.Operation{Logger: h.logger, Name: "keys.rotate"}, StatusCode: http.StatusInternalServerError, Err: err})
		return
	}
	respond.JSON(w, http.StatusOK, key)
}

func (h *handler) delete(w http.ResponseWriter, r *http.Request) {
	envUUID, ok := parseEnvUUID(w, r.PathValue("env_uuid"))
	if !ok {
		return
	}
	if err := h.store.Delete(r.Context(), envUUID); err != nil {
		respond.Failure(w, r, respond.FailureDetails{Operation: respond.Operation{Logger: h.logger, Name: "keys.delete"}, StatusCode: http.StatusInternalServerError, Err: err})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseEnvUUID(w http.ResponseWriter, raw string) (string, bool) {
	id, err := uuid.Parse(raw)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "environment uuid must be a UUID")
		return "", false
	}
	return id.String(), true
}
