---
name: using-better-auth
description: Implement auth and identity with better-auth + better-auth-ui out-of-the-box. Use for any identity work - sign-in/up, account, session, or organization UI.
---

# Using better-auth

All identity is better-auth - one source of truth, no parallel auth
system. UI comes from better-auth-ui, used as-is.

## Architecture

- better-auth is our identity layer, owned by the control-plane service (users/sessions/accounts; org plugin for orgs/members/roles). We use a BFF model.
- Identity is 100% better-auth. Don't hand-roll tables, forms, or session logic that the library already provides.
- Exception: opaque env keys are custom (no TTL, instant revoke), not better-auth's apiKey/jwt plugins.

## UI policy

- Install components via the **better-auth-ui shadcn registry** (https://better-auth-ui.com/docs/shadcn) - don't copy/paste or rebuild them.
- Use the `<Auth>`, account, and organization components as shipped. Configure through props/context/`AuthUIProvider`; don't fork their internals.
- Wire UI to the control-plane better-auth handler. Compose a wrapper for layout, not a replacement form.
- Same shadcn rules apply - see `AGENTS.md`.

## Going deeper

Verify against live docs, don't guess. WebFetch the relevant index, then the
matching page:

- `https://www.better-auth.com/llms.txt` - better-auth core (config, plugins, server).
- `https://better-auth-ui.com/llms.txt` - better-auth-ui components & setup.

Match usage to the installed better-auth version, not just "latest"
docs.
