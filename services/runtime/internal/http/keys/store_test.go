package keys_test

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/peretyn/peretyn/services/runtime/internal/http/keys"
	"github.com/peretyn/peretyn/services/runtime/internal/http/keys/keystest"
	"github.com/stretchr/testify/require"
)

const testPrefix = "prn_"

func TestStore(t *testing.T) {
	ctx := context.Background()

	t.Run("lookup on empty store returns false", func(t *testing.T) {
		s := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
		_, ok, _ := s.Lookup(ctx, testPrefix+"anything")
		if ok {
			t.Error("expected false on empty store")
		}
	})

	t.Run("lookup after create returns correct context", func(t *testing.T) {
		s := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
		key, err := s.Create(ctx, keys.CreateReq{
			EnvironmentUUID: "env-1",
			StoreID:         "s1",
			ProjectSlug:     "proj",
			EnvironmentName: "dev",
		})
		require.NoError(t, err)
		tc, ok, _ := s.Lookup(ctx, key.Plaintext)
		if !ok {
			t.Fatal("expected token to be found")
		}
		if tc.StoreID != "s1" {
			t.Errorf("StoreID = %q, want s1", tc.StoreID)
		}
		if tc.Environment != "dev" {
			t.Errorf("Environment = %q, want dev", tc.Environment)
		}
	})

	t.Run("unknown token returns false", func(t *testing.T) {
		s := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
		_, _ = s.Create(ctx, keys.CreateReq{EnvironmentUUID: "env-u", StoreID: "s1", EnvironmentName: "dev"})
		_, ok, _ := s.Lookup(ctx, testPrefix+"notarealtoken00000000000000000000000000000000")
		if ok {
			t.Error("expected false for unknown token")
		}
	})

	t.Run("rotate invalidates old token and keeps new", func(t *testing.T) {
		s := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
		old, err := s.Create(ctx, keys.CreateReq{EnvironmentUUID: "env-2", StoreID: "s1", ProjectSlug: "proj", EnvironmentName: "dev"})
		require.NoError(t, err)
		rotated, err := s.Rotate(ctx, "env-2")
		require.NoError(t, err)
		if _, ok, _ := s.Lookup(ctx, old.Plaintext); ok {
			t.Error("old token should be gone after rotate")
		}
		tc, ok, _ := s.Lookup(ctx, rotated.Plaintext)
		if !ok {
			t.Fatal("new token should be present after rotate")
		}
		if tc.StoreID != "s1" {
			t.Errorf("StoreID = %q, want s1", tc.StoreID)
		}
	})

	t.Run("delete removes key", func(t *testing.T) {
		s := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
		key, err := s.Create(ctx, keys.CreateReq{EnvironmentUUID: "env-3", StoreID: "s1", EnvironmentName: "dev"})
		require.NoError(t, err)
		require.NoError(t, s.Delete(ctx, "env-3"))
		if _, ok, _ := s.Lookup(ctx, key.Plaintext); ok {
			t.Error("token should be gone after delete")
		}
	})

	t.Run("rotate on unknown env returns error", func(t *testing.T) {
		s := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
		_, err := s.Rotate(ctx, "no-such-env")
		if err == nil {
			t.Error("expected error for unknown env")
		}
	})

	t.Run("generated token has correct prefix", func(t *testing.T) {
		s := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
		key, err := s.Create(ctx, keys.CreateReq{EnvironmentUUID: "env-5", StoreID: "s1", EnvironmentName: "dev"})
		require.NoError(t, err)
		if !strings.HasPrefix(key.Plaintext, testPrefix) {
			t.Errorf("token %q doesn't start with %q", key.Plaintext, testPrefix)
		}
	})

	t.Run("concurrent lookup and rotate no race", func(t *testing.T) {
		s := keys.NewStore(keystest.NewMemoryRepository(), testPrefix)
		key, err := s.Create(ctx, keys.CreateReq{EnvironmentUUID: "env-6", StoreID: "s1", EnvironmentName: "dev"})
		require.NoError(t, err)
		var wg sync.WaitGroup
		for i := 0; i < 20; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, _, _ = s.Lookup(ctx, key.Plaintext)
			}()
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = s.Rotate(ctx, "env-6")
		}()
		wg.Wait()
	})
}

type unusedRepository struct {
	keys.Repository
}

func TestLookupRejectsForeignTokensWithoutQuerying(t *testing.T) {
	s := keys.NewStore(unusedRepository{}, testPrefix)
	_, ok, err := s.Lookup(context.Background(), "not-a-peretyn-key")
	require.NoError(t, err)
	require.False(t, ok)
}
