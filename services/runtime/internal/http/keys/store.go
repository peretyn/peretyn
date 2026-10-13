package keys

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/peretyn/peretyn/services/runtime/internal/http/auth"
)

const cacheTTL = 30 * time.Second

const keyEntropyBytes = 32

var (
	ErrNotFound = errors.New("environment key not found")
	ErrExists   = errors.New("environment key already exists")
)

type Key struct {
	Plaintext string `json:"plaintext"`
	Prefix    string `json:"prefix"`
	Last4     string `json:"last4"`
}

type storeEntry struct {
	tc        auth.TokenContext
	expiresAt time.Time
}

func (e storeEntry) valid() bool {
	return time.Now().Before(e.expiresAt)
}

type Store struct {
	mu         sync.RWMutex
	byHash     map[string]storeEntry
	generation uint64

	repo      Repository
	keyPrefix string
}

func NewStore(repo Repository, keyPrefix string) *Store {
	return &Store{
		byHash:    make(map[string]storeEntry),
		repo:      repo,
		keyPrefix: keyPrefix,
	}
}

type CreateReq struct {
	EnvironmentUUID string `json:"environmentUuid"`
	StoreID         string `json:"storeId"`
	ProjectSlug     string `json:"projectSlug"`
	EnvironmentName string `json:"environmentName"`
}

func (s *Store) Create(ctx context.Context, req CreateReq) (Key, error) {
	key, credential := s.issue(req.EnvironmentName)
	err := s.repo.Insert(ctx, Record{
		EnvironmentUUID: req.EnvironmentUUID,
		StoreID:         req.StoreID,
		ProjectSlug:     req.ProjectSlug,
		EnvironmentName: req.EnvironmentName,
		Credential:      credential,
	})
	if err != nil {
		return Key{}, fmt.Errorf("create key: %w", err)
	}
	return key, nil
}

func (s *Store) Rotate(ctx context.Context, envUUID string) (Key, error) {
	var key Key
	oldHash, err := s.repo.Replace(ctx, envUUID, func(environmentName string) Credential {
		var credential Credential
		key, credential = s.issue(environmentName)
		return credential
	})
	if err != nil {
		return Key{}, fmt.Errorf("rotate key: %w", err)
	}
	s.evict(oldHash)
	return key, nil
}

func (s *Store) Delete(ctx context.Context, envUUID string) error {
	keyHash, found, err := s.repo.Remove(ctx, envUUID)
	if err != nil {
		return fmt.Errorf("delete key: %w", err)
	}
	if found {
		s.evict(keyHash)
	}
	return nil
}

func (s *Store) Lookup(ctx context.Context, token string) (auth.TokenContext, bool, error) {
	if !strings.HasPrefix(token, s.keyPrefix) {
		return auth.TokenContext{}, false, nil
	}
	h := hashToken(token)

	s.mu.RLock()
	entry, ok := s.byHash[h]
	generation := s.generation
	s.mu.RUnlock()

	if ok && entry.valid() {
		return entry.tc, true, nil
	}

	record, found, err := s.repo.FindByHash(ctx, h)
	if err != nil || !found {
		return auth.TokenContext{}, false, wrapLookupError(err)
	}

	entry = newEntry(record)
	s.mu.Lock()
	if s.generation == generation {
		s.byHash[h] = entry
	}
	s.mu.Unlock()

	return entry.tc, true, nil
}

func wrapLookupError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("lookup key: %w", err)
}

func (s *Store) WarmFromDB(ctx context.Context) error {
	records, err := s.repo.All(ctx)
	if err != nil {
		return fmt.Errorf("warm key cache: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, record := range records {
		s.byHash[record.Hash] = newEntry(record)
	}
	return nil
}

func newEntry(record Record) storeEntry {
	return storeEntry{
		tc:        tokenContext(record.StoreID, record.EnvironmentName, record.ProjectSlug),
		expiresAt: time.Now().Add(cacheTTL),
	}
}

func (s *Store) evict(keyHash string) {
	s.mu.Lock()
	delete(s.byHash, keyHash)
	s.generation++
	s.mu.Unlock()
}

func tokenContext(storeID, environment, projectSlug string) auth.TokenContext {
	return auth.TokenContext{StoreID: storeID, Environment: environment, ProjectSlug: projectSlug, Kind: "env"}
}

func (s *Store) issue(environmentName string) (Key, Credential) {
	kind := "test"
	if environmentName == "production" {
		kind = "live"
	}
	prefix := s.keyPrefix + kind + "_"
	b := make([]byte, keyEntropyBytes)
	_, _ = rand.Read(b)
	plaintext := prefix + base64.RawURLEncoding.EncodeToString(b)
	key := Key{Plaintext: plaintext, Prefix: prefix, Last4: plaintext[len(plaintext)-4:]}
	return key, Credential{Hash: hashToken(plaintext), Prefix: key.Prefix, Last4: key.Last4}
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
