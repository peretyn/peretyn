package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
)

var errArtifactIncomplete = errors.New("missing model/dsl — regenerate with peretyn build")

type artifact struct {
	DSL   string          `json:"dsl"`
	Model json.RawMessage `json:"model"`
}

func loadArtifact(path string) (*artifact, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read artifact %s: %w (run peretyn build first)", path, err)
	}
	var a artifact
	if err := json.Unmarshal(raw, &a); err != nil {
		return nil, fmt.Errorf("parse artifact %s: %w", path, err)
	}
	if len(a.Model) == 0 || a.DSL == "" {
		return nil, fmt.Errorf("artifact %s %w", path, errArtifactIncomplete)
	}
	return &a, nil
}

type modelDiff struct {
	AddedTypes   []string `json:"addedTypes"`
	RemovedTypes []string `json:"removedTypes"`
	ChangedTypes []struct {
		Type             string   `json:"type"`
		AddedRelations   []string `json:"addedRelations"`
		RemovedRelations []string `json:"removedRelations"`
	} `json:"changedTypes"`
	HasChanges bool `json:"hasChanges"`
}

func printDiff(d modelDiff) {
	if !d.HasChanges {
		fmt.Println("no changes — deployed schema matches the artifact")
		return
	}
	fmt.Println("plan: changes to apply")
	for _, t := range d.AddedTypes {
		fmt.Printf("  + type %s\n", t)
	}
	for _, t := range d.RemovedTypes {
		fmt.Printf("  - type %s\n", t)
	}
	for _, ct := range d.ChangedTypes {
		fmt.Printf("  ~ type %s\n", ct.Type)
		for _, r := range ct.AddedRelations {
			fmt.Printf("      + %s\n", r)
		}
		for _, r := range ct.RemovedRelations {
			fmt.Printf("      - %s\n", r)
		}
	}
	fmt.Println("\nrun: peretyn apply --label <label>")
}
