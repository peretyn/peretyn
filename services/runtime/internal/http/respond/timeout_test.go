package respond

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestWithTimeoutBoundsTheRequest(t *testing.T) {
	var deadline time.Time
	var ok bool

	h := WithTimeout(50*time.Millisecond, http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		deadline, ok = r.Context().Deadline()
	}))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))

	require.True(t, ok)
	require.WithinDuration(t, time.Now().Add(50*time.Millisecond), deadline, 25*time.Millisecond)
}

func TestWithTimeoutDisabledWhenNotPositive(t *testing.T) {
	for _, d := range []time.Duration{0, -time.Second} {
		var ok bool
		h := WithTimeout(d, http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			_, ok = r.Context().Deadline()
		}))
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
		require.False(t, ok, "timeout %s must not expire the request immediately", d)
	}
}
