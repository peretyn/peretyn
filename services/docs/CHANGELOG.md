# @peretyn/docs

## 0.8.1

### Patch Changes

- 4fa3c9c: The Quickstart shows animated captures of installing Peretyn, creating a project in the dashboard, setting the environment and publishing the schema, and its publish step now previews changes with `peretyn plan`. `pnpm --filter @peretyn/docs capture` records the captures again.
- ed6237e: The tutorial uses its own schema labels, names each step's script, says what each chapter needs, shares a small helpers file across scripts, and opens each step with a one-line summary. It checks visitors who aren't signed in, lists what a user can see, calls the company a company, and states where blocks, admins and folder moves need care. Concepts explains wildcards, and the Quickstart says that step 1 needs a browser.
- 8965372: The installer no longer needs root: it defaults to `~/peretyn` for other users and `/opt/peretyn` for root, and finds an existing install in either directory. The self-hosting page says so, and its local evaluation section no longer repeats the installer command. The Quickstart starts Peretyn with the installer and its defaults.

## 0.8.0

### Minor Changes

- 0f94e18: A new Tutorial section tells the story of a shared drive over six chapters: owners and sharing, teams, folders, public links, the company and exceptions. Key terms show their definition on hover, and the Concepts table links each schema function to the chapter that teaches it.

### Patch Changes

- e82b2df: The self-hosting page lists every installer question with its default, the prerequisites the installer checks, the leftover-database stop, and the sender address the installer sets.

## 0.7.3

### Patch Changes

- 49af30d: At a terminal, the installer shows a summary of your answers and asks you to confirm before it installs. Running it again says which version it upgrades from and to, and does nothing when you are already on that version. The docs list `GITHUB_TOKEN`. The domain falls back to `localhost`, and the install ends by saying where to change your settings. A fresh install stops when a database from an earlier install is still in Docker, instead of crashing on its old password. With Bash available, the prompts complete paths with Tab and edit like a shell.

## 0.7.2

### Patch Changes

- 657d15c: The installer asks for the install directory at a terminal, defaulting to `/opt/peretyn`, and expands a leading `~` in `PERETYN_DIR`.

## 0.7.1

### Patch Changes

- 35f0c47: The HTTP API and self-hosting pages use a self-hosted Peretyn URL instead of `app.peretyn.dev`.

## 0.7.0

### Minor Changes

- fd74d72: Measure docs visits with Umami Cloud, served through docs.peretyn.dev so ad blockers don't hide readers.

## 0.6.2

### Patch Changes

- 4ed4ee3: The quickstart has a self-hosted version, and a managed version that stays hidden until managed Peretyn opens. Self-hosting documents which flows need email.

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
