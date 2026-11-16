---
'@peretyn/runtime': patch
'@peretyn/docs': patch
---

At a terminal, the installer shows a summary of your answers and asks you to confirm before it installs. Running it again says which version it upgrades from and to, and does nothing when you are already on that version. The docs list `GITHUB_TOKEN`. The domain falls back to `localhost`, and the install ends by saying where to change your settings. A fresh install stops when a database from an earlier install is still in Docker, instead of crashing on its old password. With Bash available, the prompts complete paths with Tab and edit like a shell.
