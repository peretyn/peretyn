package main

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestServeShutsTheOtherListenerDownWhenOneFails(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = taken.Close() })

	shutDown := make(chan struct{})
	healthy := &http.Server{Addr: "127.0.0.1:0", Handler: http.NotFoundHandler()}
	healthy.RegisterOnShutdown(func() { close(shutDown) })
	failing := &http.Server{Addr: taken.Addr().String(), Handler: http.NotFoundHandler()}

	err = serve(context.Background(), zap.NewNop(), healthy, failing)
	require.ErrorContains(t, err, "address already in use")
	select {
	case <-shutDown:
	case <-time.After(time.Second):
		t.Fatal("the healthy listener must be shut down, not abandoned")
	}
}
