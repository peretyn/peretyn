# @peretyn/docs

## 0.6.1

### Patch Changes

- 9b60729: The CLI installer prints the PATH line to add and the next command to run, and the CLI says model where it said artifact.
- b2379c4: The installer ends with the credentials and next steps instead of a log line, and without a terminal it prints a ready-to-paste unattended command.

## 0.6.0

### Minor Changes

- 1414c5f: Install on localhost over plain HTTP to evaluate Peretyn without a domain. The installer refuses IP addresses and warns about domains that can't get a public certificate.

## 0.5.0

### Minor Changes

- 30f38da: Add an HTTP API page that reaches a first check with curl, and link it from the introduction.
- 1b90b28: Serve /llms.txt with what Peretyn is, its install commands and an index of the docs.
- e182b73: Document self-host operations, and the limits and guarantees of Peretyn today.
- aa7fc28: Add a roles and permissions (RBAC) guide.

### Patch Changes

- aa45367: Make the quickstart work as written on a fresh self-hosted install.

## 0.4.0

### Minor Changes

- 7b975c2: Document the one-line CLI installer and how to verify the CLI binary.

## 0.3.1

### Patch Changes

- 50ef34f: Document how to verify the signed build provenance of release images.
- b859ca7: Use peretyn.dev/install in the self-hosting install commands.

## 0.3.0

### Minor Changes

- f1766b8: Document the one-line self-hosting installer, its unattended mode and how to verify it before running.

## 0.2.1

### Patch Changes

- 145c02f: Use the peretyn.dev green for links, the active page and section labels.

## 0.2.0

### Minor Changes

- 5a7c7eb: Add the SDK, CLI and Self-hosting pages.

## 0.1.0

### Minor Changes

- 33c50d5: Add the HTTP API reference, generated from the OpenAPI spec.
- 7de8eb0: Add the docs app for docs.peretyn.dev.
- f98096a: Add the Introduction, Quickstart and Concepts pages.
