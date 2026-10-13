package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"

	"github.com/spf13/cobra"
)

type projectConfig struct {
	Control string `json:"control"`
	Runtime string `json:"runtime"`
	Model   string `json:"model"`
}

func loadProjectConfig() (projectConfig, error) {
	path := os.Getenv("PERETYN_CONFIG")
	explicit := path != ""
	if !explicit {
		path = "peretyn.json"
	}
	var cfg projectConfig
	raw, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) && !explicit {
		return cfg, nil
	}
	if err != nil {
		return cfg, fmt.Errorf("read config: %w", err)
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return cfg, fmt.Errorf("parse %s: %w", path, err)
	}
	return cfg, nil
}

type settings struct {
	token   string
	control string
	runtime string
	model   string
}

func (s *settings) bindToken(cmd *cobra.Command) {
	cmd.Flags().StringVar(&s.token, "token", "", "env API key, prn_live_… or prn_test_… (default $PERETYN_TOKEN)")
}

func (s *settings) bindModel(cmd *cobra.Command, name, short string) {
	cmd.Flags().StringVarP(&s.model, name, short, "", `compiled artifact path (default peretyn.json "model", else peretyn.model.json)`)
}

func (s *settings) bindControl(cmd *cobra.Command) {
	cmd.Flags().StringVar(&s.control, "control", "", "control plane URL (default $PERETYN_CONTROL_URL, peretyn.json \"control\", else http://localhost:3001)")
}

func (s *settings) bindRuntime(cmd *cobra.Command) {
	cmd.Flags().StringVar(&s.runtime, "runtime", "", "runtime URL (default $PERETYN_RUNTIME_URL, peretyn.json \"runtime\", else http://localhost:8080)")
}

func (s *settings) resolve() error {
	cfg, err := loadProjectConfig()
	if err != nil {
		return err
	}
	s.token = firstNonEmpty(s.token, os.Getenv("PERETYN_TOKEN"))
	s.control = firstNonEmpty(s.control, os.Getenv("PERETYN_CONTROL_URL"), cfg.Control, "http://localhost:3001")
	s.runtime = firstNonEmpty(s.runtime, os.Getenv("PERETYN_RUNTIME_URL"), cfg.Runtime, "http://localhost:8080")
	s.model = firstNonEmpty(s.model, cfg.Model, "peretyn.model.json")
	return nil
}

var errTokenRequired = errors.New("a token is required (--token or $PERETYN_TOKEN)")

func (s *settings) requireToken() error {
	if s.token == "" {
		return errTokenRequired
	}
	return nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
