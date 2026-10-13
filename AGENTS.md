## Rules

- GitHub issues and PRs are the source of truth. Split an issue into focused PRs; reference it with `Refs #N`, and use `Closes #N` only in the PR that finishes it.
- **Never create or edit GitHub content (issues, PRs, comments, releases) or `git push` without explicit human approval, every time.**
- Off-the-shelf first: use proven libraries; write custom code only when none fits.
- All identity is better-auth (skill: `using-better-auth`).
- UI: add components from shadcn/ui registries (`pnpm ui:add`, `pnpm dash:add`) and use them as-is. Don't modify them unless asked.
- No comments. If code needs one, make the code clearer instead.
- Keep it simple: one obvious way, small cohesive files organized by feature, each fact in one place.
- No secrets in tracked files. `.env` holds local-dev defaults; real credentials go in `.env.local`.
- Conventional commits.
- Releases: `RELEASING.md`.

## Testing

- NEVER write unit tests after you write code.
- Highly prefer E2E tests as the sole testing mechanism. Use them to verify complex feature work. At the end of E2E tests, produce a verifiable and repeatable artifact.
- If you must test a system in isolation, FIRST write all the ways it could fail, THEN write the code.

## Before committing

`pnpm format:write`, then `pnpm typecheck`, `pnpm lint` and `pnpm build` must pass.

## Next.js

Before any Next.js work, read the relevant doc in `services/dashboard/node_modules/next/dist/docs/`. It is newer than your training data.
