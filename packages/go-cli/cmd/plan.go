package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

func newPlanCmd() *cobra.Command {
	var s settings
	var label string
	cmd := &cobra.Command{
		Use:   "plan",
		Short: "Preview the changes apply would make",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runPlan(&s, label)
		},
	}
	s.bindToken(cmd)
	s.bindModel(cmd, "model", "")
	s.bindControl(cmd)
	cmd.Flags().StringVar(&label, "label", "", "label to suggest for the apply command")
	return cmd
}

func fetchDiff(s *settings, art *artifact) (modelDiff, error) {
	var diff modelDiff
	err := post(postRequest{base: s.control, token: s.token, path: "/publish/v1/schema/plan", body: map[string]any{"model": art.Model}, out: &diff})
	return diff, err
}

func runPlan(s *settings, label string) error {
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
	diff, err := fetchDiff(s, art)
	if err != nil {
		return err
	}
	printDiff(diff)
	if !diff.HasChanges {
		return nil
	}
	if diff.removesSomething() {
		fmt.Println("This removes types or relations. Checks stop counting the tuples stored under them.")
		fmt.Println()
	}
	fmt.Printf("run: %s\n", applyCommand(label, diff))
	return nil
}
