package auth

import (
	"context"
	"net/http"
)

type TokenContext struct {
	StoreID     string
	Environment string
	ProjectSlug string
	Kind        string
}

type KeyLookup interface {
	Lookup(ctx context.Context, token string) (TokenContext, bool, error)
}

type ctxKey struct{}

func FromContext(ctx context.Context) TokenContext {
	tc, _ := ctx.Value(ctxKey{}).(TokenContext)
	return tc
}

func WithContext(ctx context.Context, tc TokenContext) context.Context {
	return context.WithValue(ctx, ctxKey{}, tc)
}

func StoreID(r *http.Request) string {
	return FromContext(r.Context()).StoreID
}
