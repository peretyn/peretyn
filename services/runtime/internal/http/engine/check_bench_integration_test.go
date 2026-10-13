//go:build integration

package engine

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/peretyn/peretyn/services/runtime/internal/fga"
	"github.com/peretyn/peretyn/services/runtime/internal/storage"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	"go.uber.org/zap"
)

const benchTuples = 100

func TestMain(m *testing.M) {
	ctx := context.Background()
	ctr, err := tcpostgres.Run(ctx, "postgres:16-alpine",
		tcpostgres.WithDatabase("peretyn_test"),
		tcpostgres.WithUsername("postgres"),
		tcpostgres.WithPassword("postgres"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		panic("start postgres: " + err.Error())
	}
	defer func() { _ = ctr.Terminate(ctx) }()

	dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		panic("connection string: " + err.Error())
	}

	pool, err := storage.Connect(ctx, dsn, "peretyn_runtime")
	if err != nil {
		panic("storage.Connect: " + err.Error())
	}
	pool.Close()

	benchDSN = dsn + "&search_path=%22peretyn_runtime%22"
	os.Exit(m.Run())
}

var benchDSN string

func BenchmarkCheck(b *testing.B) {
	require.NoError(b, storage.RunMigrations(benchDSN))

	datastore, err := fga.NewPostgresDatastore(benchDSN, zap.NewNop())
	require.NoError(b, err)
	srv, closeFGA, err := fga.New(context.Background(), fga.Config{Datastore: datastore, Logger: zap.NewNop()})
	require.NoError(b, err)
	b.Cleanup(closeFGA)

	ctx := context.Background()
	store, err := srv.CreateStore(ctx, &openfgav1.CreateStoreRequest{Name: "bench"})
	require.NoError(b, err)

	model := testModel()
	model.StoreId = store.GetId()
	_, err = srv.WriteAuthorizationModel(ctx, model)
	require.NoError(b, err)

	tuples := make([]*openfgav1.TupleKey, 0, benchTuples)
	for i := range benchTuples {
		tuples = append(tuples, &openfgav1.TupleKey{
			User: "user:alice", Relation: "viewer", Object: fmt.Sprintf("document:d%d", i),
		})
	}
	_, err = srv.Write(ctx, &openfgav1.WriteRequest{
		StoreId: store.GetId(),
		Writes:  &openfgav1.WriteRequestWrites{TupleKeys: tuples},
	})
	require.NoError(b, err)

	req := &openfgav1.CheckRequest{
		StoreId:  store.GetId(),
		TupleKey: &openfgav1.CheckRequestTupleKey{User: "user:alice", Relation: "viewer"},
	}

	b.ResetTimer()
	for i := 0; b.Loop(); i++ {
		req.TupleKey.Object = fmt.Sprintf("document:d%d", i%benchTuples)
		_, err := srv.Check(ctx, req)
		require.NoError(b, err)
	}
}

func testModel() *openfgav1.WriteAuthorizationModelRequest {
	return &openfgav1.WriteAuthorizationModelRequest{
		SchemaVersion: "1.1",
		TypeDefinitions: []*openfgav1.TypeDefinition{
			{Type: "user"},
			{
				Type: "document",
				Relations: map[string]*openfgav1.Userset{
					"viewer": {Userset: &openfgav1.Userset_This{This: &openfgav1.DirectUserset{}}},
					"editor": {Userset: &openfgav1.Userset_This{This: &openfgav1.DirectUserset{}}},
					"can_read": {Userset: &openfgav1.Userset_Union{Union: &openfgav1.Usersets{
						Child: []*openfgav1.Userset{
							{Userset: &openfgav1.Userset_ComputedUserset{ComputedUserset: &openfgav1.ObjectRelation{Relation: "viewer"}}},
							{Userset: &openfgav1.Userset_ComputedUserset{ComputedUserset: &openfgav1.ObjectRelation{Relation: "editor"}}},
						},
					}}},
				},
				Metadata: &openfgav1.Metadata{
					Relations: map[string]*openfgav1.RelationMetadata{
						"viewer": {DirectlyRelatedUserTypes: []*openfgav1.RelationReference{{Type: "user"}}},
						"editor": {DirectlyRelatedUserTypes: []*openfgav1.RelationReference{{Type: "user"}}},
					},
				},
			},
		},
	}
}
