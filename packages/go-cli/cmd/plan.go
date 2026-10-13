package cmd

import "github.com/spf13/cobra"

func newPlanCmd() *cobra.Command {
	var s settings
	cmd := &cobra.Command{
		Use:   "plan",
		Short: "Preview the changes apply would make",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runPlan(&s)
		},
	}
	s.bindToken(cmd)
	s.bindModel(cmd, "model", "")
	s.bindControl(cmd)
	return cmd
}

func runPlan(s *settings) error {
	if err := s.resolve(); err != nil {
		return err
	}
	if err := s.requireToken(); err != nil {
		return err
	}
	art, err := loadArtifact(s.model)
	if err != nil {
		return err
	}
	var diff modelDiff
	if err := post(postRequest{base: s.control, token: s.token, path: "/publish/v1/schema/plan", body: map[string]any{"model": art.Model}, out: &diff}); err != nil {
		return err
	}
	printDiff(diff)
	return nil
}
