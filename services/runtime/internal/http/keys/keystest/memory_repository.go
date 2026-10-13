package keystest

import (
	"context"
	"sync"

	"github.com/peretyn/peretyn/services/runtime/internal/http/keys"
)

type MemoryRepository struct {
	mu        sync.Mutex
	byEnvUUID map[string]keys.Record
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{byEnvUUID: make(map[string]keys.Record)}
}

func (r *MemoryRepository) Insert(_ context.Context, record keys.Record) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.byEnvUUID[record.EnvironmentUUID]; exists {
		return keys.ErrExists
	}
	r.byEnvUUID[record.EnvironmentUUID] = record
	return nil
}

func (r *MemoryRepository) Replace(_ context.Context, envUUID string, issue func(environmentName string) keys.Credential) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	record, exists := r.byEnvUUID[envUUID]
	if !exists {
		return "", keys.ErrNotFound
	}
	oldHash := record.Hash
	record.Credential = issue(record.EnvironmentName)
	r.byEnvUUID[envUUID] = record
	return oldHash, nil
}

func (r *MemoryRepository) Remove(_ context.Context, envUUID string) (string, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	record, exists := r.byEnvUUID[envUUID]
	delete(r.byEnvUUID, envUUID)
	return record.Hash, exists, nil
}

func (r *MemoryRepository) FindByHash(_ context.Context, keyHash string) (keys.Record, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, record := range r.byEnvUUID {
		if record.Hash == keyHash {
			return record, true, nil
		}
	}
	return keys.Record{}, false, nil
}

func (r *MemoryRepository) All(_ context.Context) ([]keys.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	records := make([]keys.Record, 0, len(r.byEnvUUID))
	for _, record := range r.byEnvUUID {
		records = append(records, record)
	}
	return records, nil
}
