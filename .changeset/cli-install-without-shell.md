---
'@peretyn/go-cli': patch
---

The CLI installer finishes when `SHELL` is unset, as over `docker exec` or in minimal containers, and prints the PATH line and the next step.
