package cmd

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"
)

func newApplyCmd() *cobra.Command {
	var s settings
	var label string
	cmd := &cobra.Command{
		Use:   "apply",
		Short: "Deploy the compiled artifact under a version label",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runApply(&s, label)
		},
	}
	s.bindToken(cmd)
	s.bindModel(cmd, "model", "")
	s.bindControl(cmd)
	cmd.Flags().StringVar(&label, "label", "", "schema version label (required)")
	return cmd
}

var errLabelRequired = errors.New("--label is required")

func runApply(s *settings, label string) error {
	if err := s.resolve(); err != nil {
		return err
	}
	if err := s.requireToken(); err != nil {
		return err
	}
	if label == "" {
		return errLabelRequired
	}
	art, err := loadArtifact(s.model)
	if err != nil {
		return err
	}
	var resp struct {
		SchemaVersion struct {
			ID                          string `json:"id"`
			Label                       string `json:"label"`
			OpenfgaAuthorizationModelID string `json:"openfgaAuthorizationModelId"`
		} `json:"schemaVersion"`
	}
	body := map[string]any{"label": label, "model": art.Model, "dsl": art.DSL}
	if err := post(postRequest{base: s.control, token: s.token, path: "/publish/v1/schema", body: body, out: &resp}); err != nil {
		return err
	}
	fmt.Printf("✓ applied %q → model %s (version %s)\n",
		resp.SchemaVersion.Label, resp.SchemaVersion.OpenfgaAuthorizationModelID, resp.SchemaVersion.ID)
	return nil
}
