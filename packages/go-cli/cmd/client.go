package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const httpClientTimeout = 30 * time.Second

var httpClient = &http.Client{Timeout: httpClientTimeout}

type postRequest struct {
	base  string
	token string
	path  string
	body  any
	out   any
}

type responseStatusError struct {
	url    string
	status int
	body   string
}

func (e *responseStatusError) Error() string {
	return fmt.Sprintf("POST %s -> %d: %s", e.url, e.status, e.body)
}

func post(request postRequest) error {
	buf, err := json.Marshal(request.body)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}
	url := strings.TrimRight(request.base, "/") + request.path
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(buf))
	if err != nil {
		return fmt.Errorf("POST %s: build request: %w", url, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+request.token)
	res, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("POST %s: %w", url, err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("POST %s: read response: %w", url, err)
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return &responseStatusError{url: url, status: res.StatusCode, body: strings.TrimSpace(string(raw))}
	}
	if request.out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, request.out); err != nil {
			return fmt.Errorf("POST %s: parse response: %w", url, err)
		}
	}
	return nil
}
