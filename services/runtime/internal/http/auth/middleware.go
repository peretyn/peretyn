package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/peretyn/peretyn/services/runtime/internal/http/respond"
	"go.uber.org/zap"
)

func RequireInternal(secret string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			presented := sha256.Sum256([]byte(r.Header.Get("X-Peretyn-Internal-Secret")))
			expected := sha256.Sum256([]byte(secret))
			if secret == "" || subtle.ConstantTimeCompare(presented[:], expected[:]) != 1 {
				respond.Error(w, http.StatusUnauthorized, "missing or invalid internal credential")
				return
			}
			next.ServeHTTP(w, r)
		}
	}
}

func RequireToken(logger *zap.Logger, keys KeyLookup) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			bearer := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			tc, ok, err := keys.Lookup(r.Context(), bearer)
			if err != nil {
				respond.Failure(w, r, respond.FailureDetails{Operation: respond.Operation{Logger: logger, Name: "keys.lookup"}, StatusCode: http.StatusServiceUnavailable, Err: err})
				return
			}
			if !ok {
				respond.Error(w, http.StatusUnauthorized, "missing or unknown bearer token")
				return
			}
			if tc.StoreID == "" {
				respond.Error(w, http.StatusForbidden, "token is not scoped to a store")
				return
			}
			next.ServeHTTP(w, r.WithContext(WithContext(r.Context(), tc)))
		}
	}
}

func me(w http.ResponseWriter, r *http.Request) {
	tc := FromContext(r.Context())
	respond.JSON(w, http.StatusOK, map[string]string{
		"storeId":     tc.StoreID,
		"environment": tc.Environment,
		"projectSlug": tc.ProjectSlug,
		"kind":        tc.Kind,
	})
}

func Routes(mux *http.ServeMux, requireToken func(http.HandlerFunc) http.HandlerFunc) {
	mux.HandleFunc("GET /v1/me", requireToken(me))
}
