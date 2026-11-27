# @peretyn/runtime

## 0.5.0

## 0.4.3

### Patch Changes

- 8965372: The installer no longer needs root: it defaults to `~/peretyn` for other users and `/opt/peretyn` for root, and finds an existing install in either directory. The self-hosting page says so, and its local evaluation section no longer repeats the installer command. The Quickstart starts Peretyn with the installer and its defaults.

## 0.4.2

### Patch Changes

- 49af30d: At a terminal, the installer shows a summary of your answers and asks you to confirm before it installs. Running it again says which version it upgrades from and to, and does nothing when you are already on that version. The docs list `GITHUB_TOKEN`. The domain falls back to `localhost`, and the install ends by saying where to change your settings. A fresh install stops when a database from an earlier install is still in Docker, instead of crashing on its old password. With Bash available, the prompts complete paths with Tab and edit like a shell.

## 0.4.1

### Patch Changes

- 657d15c: The installer asks for the install directory at a terminal, defaulting to `/opt/peretyn`, and expands a leading `~` in `PERETYN_DIR`.

## 0.4.0

### Minor Changes

- 457383f: Engine errors use Peretyn's terms and say how to fix the mistake: writing a tuple to a permission, a subject type a relation doesn't accept, an undefined relation or type, and an environment with no schema yet. The SDK checks the arguments of `check`, `assert`, `batchCheck` and `write` before calling the runtime, and `check` leaves out an empty `resolution`.

## 0.3.2

### Patch Changes

- 16f560e: Stop the runtime burning CPU while idle by turning off OpenFGA dispatch throttling, whose tickers woke up every 10µs.

## 0.3.1

### Patch Changes

- b2379c4: The installer ends with the credentials and next steps instead of a log line, and without a terminal it prints a ready-to-paste unattended command.

## 0.3.0

### Minor Changes

- 1414c5f: Install on localhost over plain HTTP to evaluate Peretyn without a domain. The installer refuses IP addresses and warns about domains that can't get a public certificate.

## 0.2.2

## 0.2.1

### Patch Changes

- f1766b8: Attach the self-hosting installer and its SHA256SUMS to the runtime release.

## 0.2.0

## 0.1.2

## 0.1.1

Initial public release.
