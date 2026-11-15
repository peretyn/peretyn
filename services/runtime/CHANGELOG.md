# @peretyn/runtime

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
