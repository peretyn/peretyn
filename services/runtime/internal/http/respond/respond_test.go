package respond

import (
	"context"
	"errors"
	"net/http"
	"testing"

	servererrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestEngineStatusFollowsOpenFGA(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		want int
	}{
		{"validation", servererrors.TypeNotFound("folder"), http.StatusBadRequest},
		{"store not found", servererrors.ErrStoreIDNotFound, http.StatusNotFound},
		{"write conflict", status.Error(codes.Aborted, "transactional write failed"), http.StatusConflict},
		{"throttled", servererrors.ErrThrottledTimeout, http.StatusUnprocessableEntity},
		{"datastore throttled", servererrors.ErrTransactionThrottled, http.StatusBadGateway},
		{"internal", servererrors.NewInternalError("", errors.New("db down")), http.StatusBadGateway},
		{"not a grpc error", errors.New("boom"), http.StatusBadGateway},
		{"openfga deadline", servererrors.ErrRequestDeadlineExceeded, http.StatusGatewayTimeout},
		{"grpc deadline", status.Error(codes.DeadlineExceeded, "slow"), http.StatusGatewayTimeout},
		{"context deadline", context.DeadlineExceeded, http.StatusGatewayTimeout},
		{"wrapped context deadline", servererrors.HandleError("", context.DeadlineExceeded), http.StatusGatewayTimeout},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, _ := engineStatus(tc.err)
			require.Equal(t, tc.want, got)
		})
	}
}
