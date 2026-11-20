---
'@peretyn/runtime': patch
'@peretyn/docs': patch
---

The installer no longer needs root: it defaults to `~/peretyn` for other users and `/opt/peretyn` for root, and finds an existing install in either directory. The self-hosting page says so, and its local evaluation section no longer repeats the installer command. The Quickstart starts Peretyn with the installer and its defaults.
