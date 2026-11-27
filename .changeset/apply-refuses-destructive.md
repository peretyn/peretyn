---
'@peretyn/control': minor
'@peretyn/go-cli': minor
'@peretyn/docs': patch
---

`peretyn apply` refuses a model that removes a type or a relation, since checks stop counting the tuples stored under it. Add `--allow-destructive` to publish it anyway. This breaks scripts that remove relations on purpose until they add the flag. `apply` now prints the planned changes first, `plan` takes `--label` to fill in the suggested command, and CLI errors show the server's message instead of the raw response.
