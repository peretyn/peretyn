package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "peretyn",
	Short: "Deploy and test a compiled schema artifact",
	Long: `peretyn — deploy and test a compiled schema artifact

Auth: the env API key (--token or $PERETYN_TOKEN) — the same key the SDK uses —
identifies the environment, so plan/apply need no project/env ids. URLs and the
artifact path come from ./peretyn.json (or $PERETYN_CONFIG); flags and env vars
(PERETYN_CONTROL_URL, PERETYN_RUNTIME_URL, PERETYN_TOKEN) override the file.`,
	SilenceErrors: true,
	SilenceUsage:  true,
}

func init() {
	rootCmd.AddCommand(newBuildCmd())
	rootCmd.AddCommand(newPlanCmd())
	rootCmd.AddCommand(newApplyCmd())
	rootCmd.AddCommand(newTestCmd())
}

func Execute(version string) {
	rootCmd.Version = version
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "peretyn: %v\n", err)
		os.Exit(1)
	}
}
