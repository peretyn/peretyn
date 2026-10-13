package respond

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
)

func fail(t *testing.T, status int, err error) (*httptest.ResponseRecorder, observer.LoggedEntry) {
	t.Helper()
	core, logs := observer.New(zapcore.DebugLevel)
	logger := zap.New(core)

	mux := http.NewServeMux()
	mux.HandleFunc("DELETE /v1/stores/{id}", func(w http.ResponseWriter, r *http.Request) {
		Failure(w, r, FailureDetails{Operation: Operation{Logger: logger, Name: "DeleteStore"}, StatusCode: status, Err: err})
	})
	w := httptest.NewRecorder()
	Logging(logger, mux).ServeHTTP(w, httptest.NewRequest("DELETE", "/v1/stores/not-a-real-store", nil))

	entries := logs.FilterMessage("request failed").All()
	require.Len(t, entries, 1, "a failed request must log the underlying error exactly once")
	return w, entries[0]
}

func TestFailureHidesServerErrorDetailButLogsIt(t *testing.T) {
	w, entry := fail(t, http.StatusInternalServerError, errors.New("lookup api_key: password authentication failed for user peretyn"))

	require.Equal(t, http.StatusInternalServerError, w.Code)
	require.JSONEq(t, `{"error":"Internal Server Error","code":500}`, w.Body.String())

	require.Equal(t, zapcore.ErrorLevel, entry.Level)
	fields := entry.ContextMap()
	require.Equal(t, "DeleteStore", fields["op"])
	require.Equal(t, int64(http.StatusInternalServerError), fields["status"])
	require.Contains(t, fields["error"], "password authentication failed")
	require.NotEmpty(t, fields["request_id"], "log must correlate with the access log line")
	require.Equal(t, "not-a-real-store", fields["store_id"])
}

func TestFailureReturnsClientErrorDetailBelowErrorLevel(t *testing.T) {
	w, entry := fail(t, http.StatusNotFound, errors.New("store not found"))

	require.Equal(t, http.StatusNotFound, w.Code)
	require.JSONEq(t, `{"error":"store not found","code":404}`, w.Body.String())
	require.Less(t, entry.Level, zapcore.ErrorLevel)
}

func TestFailureReportsADeadlineAsGatewayTimeout(t *testing.T) {
	w, _ := fail(t, http.StatusInternalServerError, fmt.Errorf("rotate api_key: %w", context.DeadlineExceeded))

	require.Equal(t, http.StatusGatewayTimeout, w.Code)
	require.JSONEq(t, `{"error":"Gateway Timeout","code":504}`, w.Body.String())
}
