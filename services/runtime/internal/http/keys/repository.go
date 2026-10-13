package keys

import "context"

type Credential struct {
	Hash   string
	Prefix string
	Last4  string
}

type Record struct {
	EnvironmentUUID string
	StoreID         string
	ProjectSlug     string
	EnvironmentName string
	Credential
}

type Repository interface {
	Insert(ctx context.Context, record Record) error
	Replace(ctx context.Context, envUUID string, issue func(environmentName string) Credential) (string, error)
	Remove(ctx context.Context, envUUID string) (string, bool, error)
	FindByHash(ctx context.Context, keyHash string) (Record, bool, error)
	All(ctx context.Context) ([]Record, error)
}
