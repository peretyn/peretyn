package respond

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
)

func serveOnce(t *testing.T, threshold time.Duration) *observer.ObservedLogs {
	t.Helper()
	original := slowRequestThreshold
	slowRequestThreshold = threshold
	t.Cleanup(func() { slowRequestThreshold = original })

	core, logs := observer.New(zapcore.InfoLevel)
	h := Logging(zap.New(core), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/v1/check", nil))
	return logs
}

func TestSlowRequestLogsAsWarning(t *testing.T) {
	logs := serveOnce(t, time.Nanosecond)

	entries := logs.FilterMessage("slow request").All()
	require.Len(t, entries, 1)
	require.Equal(t, zapcore.WarnLevel, entries[0].Level)
	require.Equal(t, "/v1/check", entries[0].ContextMap()["path"])
	require.Empty(t, logs.FilterMessage("http").All(), "a request is logged once, not twice")
}

func TestFastRequestLogsAsAccessLine(t *testing.T) {
	logs := serveOnce(t, time.Hour)

	require.Len(t, logs.FilterMessage("http").All(), 1)
	require.Empty(t, logs.FilterMessage("slow request").All())
}
