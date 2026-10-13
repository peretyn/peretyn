package main

import "github.com/peretyn/peretyn/packages/go-cli/cmd"

var version = "dev"

func main() {
	cmd.Execute(version)
}
