package fga_test

import (
	"context"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/peretyn/peretyn/services/runtime/internal/fga/fgatest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewServesAStore(t *testing.T) {
	srv := fgatest.NewServer(t)

	resp, err := srv.CreateStore(context.Background(), &openfgav1.CreateStoreRequest{Name: "test"})
	require.NoError(t, err)
	assert.NotEmpty(t, resp.GetId())
}

func TestCheckSeesAWriteImmediately(t *testing.T) {
	ctx := context.Background()
	srv := fgatest.NewServer(t)

	store, err := srv.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: "immediate"})
	require.NoError(t, err)

	_, err = srv.WriteAuthorizationModel(ctx, &openfgav1.WriteAuthorizationModelRequest{
		StoreId:       store.GetId(),
		SchemaVersion: "1.1",
		TypeDefinitions: []*openfgav1.TypeDefinition{
			{Type: "user"},
			{
				Type:      "document",
				Relations: map[string]*openfgav1.Userset{"owner": {Userset: &openfgav1.Userset_This{}}},
				Metadata: &openfgav1.Metadata{
					Relations: map[string]*openfgav1.RelationMetadata{
						"owner": {DirectlyRelatedUserTypes: []*openfgav1.RelationReference{{Type: "user"}}},
					},
				},
			},
		},
	})
	require.NoError(t, err)

	check := func() bool {
		resp, err := srv.Check(ctx, &openfgav1.CheckRequest{
			StoreId:  store.GetId(),
			TupleKey: &openfgav1.CheckRequestTupleKey{User: "user:bob", Relation: "owner", Object: "document:d1"},
		})
		require.NoError(t, err)
		return resp.GetAllowed()
	}

	require.False(t, check(), "bob must not be an owner before the write")

	_, err = srv.Write(ctx, &openfgav1.WriteRequest{
		StoreId: store.GetId(),
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys: []*openfgav1.TupleKey{{User: "user:bob", Relation: "owner", Object: "document:d1"}},
		},
	})
	require.NoError(t, err)

	assert.True(t, check(), "a check straight after a write must see it, not a cached pre-write answer")
}
