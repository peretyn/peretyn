# @peretyn/sdk

## 0.2.0

### Minor Changes

- 38a2799: `peretyn build` rejects schemas that the runtime would reject, such as an unknown type, an undefined relation or a permission that can never be granted, and prints the file position of the mistake. `any()` and `intersect()` with one operand compile to that operand. When the schema module can't load, the CLI shows Node's error, with a hint for ES modules in a CommonJS package.
- 457383f: Engine errors use Peretyn's terms and say how to fix the mistake: writing a tuple to a permission, a subject type a relation doesn't accept, an undefined relation or type, and an environment with no schema yet. The SDK checks the arguments of `check`, `assert`, `batchCheck` and `write` before calling the runtime, and `check` leaves out an empty `resolution`.

## 0.1.2

### Patch Changes

- aa45367: Make the quickstart work as written on a fresh self-hosted install.

## 0.1.1

### Patch Changes

- 66aafc2: Add install instructions and npm package metadata.

## 0.1.0

Initial public release.
