---
'@peretyn/runtime': minor
'@peretyn/sdk': minor
---

Engine errors use Peretyn's terms and say how to fix the mistake: writing a tuple to a permission, a subject type a relation doesn't accept, an undefined relation or type, and an environment with no schema yet. The SDK checks the arguments of `check`, `assert`, `batchCheck` and `write` before calling the runtime, and `check` leaves out an empty `resolution`.
