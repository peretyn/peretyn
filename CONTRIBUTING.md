# Contributing to Peretyn

Thanks for your interest. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

GitHub issues are the source of truth. Open or find an issue before you work on a change, so we can agree on the approach. Small fixes, such as typos, can go straight to a pull request.

## Development setup

You need:

- Node.js 24 or later, and pnpm (`corepack enable` installs the pinned version)
- Go (the version in `services/runtime/go.mod`)
- Docker or Podman, for Postgres and Mailpit

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts Postgres and Mailpit, pushes the control schema, and runs the runtime, control and dashboard services. Open the dashboard at <http://localhost:3000> and read sign-up emails in Mailpit at <http://localhost:8025>. Stop the containers with `pnpm dev:down`.

`.env` holds local development defaults. Put your own overrides in `.env.local`, which git ignores.

To work on the docs site, run `pnpm docs:dev`.

## Making a change

1. Branch from `main`.
2. Write [conventional commits](https://www.conventionalcommits.org), for example `fix(sdk): retry on 503`.
3. If users will see the change, add a changeset with `pnpm changeset`. See [RELEASING.md](RELEASING.md).
4. Before you push, run:

   ```sh
   pnpm format:write
   pnpm typecheck
   pnpm lint
   pnpm build
   pnpm test
   ```

5. Open a pull request. Reference the issue with `Refs #N`, or `Closes #N` if the pull request finishes it.

## Project conventions

[AGENTS.md](AGENTS.md) lists the project rules, and [GLOSSARY.md](GLOSSARY.md) defines the domain terms. In short:

- Prefer proven libraries to custom code.
- Do not write code comments. Make the code clear instead.
- Add UI components from the shadcn/ui registries with `pnpm ui:add` or `pnpm dash:add`, and use them as they are.
- Prefer end-to-end tests (`packages/e2e`) to verify features.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
