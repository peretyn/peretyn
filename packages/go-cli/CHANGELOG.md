# @peretyn/go-cli

## 0.3.0

### Minor Changes

- 1e1c100: `peretyn apply` refuses a model that removes a type or a relation, since checks stop counting the tuples stored under it. Add `--allow-destructive` to publish it anyway. This breaks scripts that remove relations on purpose until they add the flag. `apply` now prints the planned changes first, `plan` takes `--label` to fill in the suggested command, and CLI errors show the server's message instead of the raw response.

### Patch Changes

- 61f645d: The CLI installer finishes when `SHELL` is unset, as over `docker exec` or in minimal containers, and prints the PATH line and the next step.

## 0.2.0

### Minor Changes

- 38a2799: `peretyn build` rejects schemas that the runtime would reject, such as an unknown type, an undefined relation or a permission that can never be granted, and prints the file position of the mistake. `any()` and `intersect()` with one operand compile to that operand. When the schema module can't load, the CLI shows Node's error, with a hint for ES modules in a CommonJS package.

## 0.1.3

### Patch Changes

- ba90ab0: The CLI release ships its binaries again, so the installer works.

## 0.1.2

### Patch Changes

- 9b60729: The CLI installer prints the PATH line to add and the next command to run, and the CLI says model where it said artifact.

## 0.1.1

### Patch Changes

- bd2e513: Release the CLI binaries with a SHA256SUMS file and signed build provenance.

## 0.1.0

Initial public release.
