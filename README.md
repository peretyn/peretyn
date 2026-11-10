# Peretyn

> TypeScript-first, composable ReBAC platform, powered by [OpenFGA](https://openfga.dev).

[![CI](https://github.com/peretyn/peretyn/actions/workflows/ci.yml/badge.svg)](https://github.com/peretyn/peretyn/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@peretyn/sdk)](https://www.npmjs.com/package/@peretyn/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Peretyn answers one question for your application: **is this allowed?** You describe who can do what as relationships between things, and Peretyn decides. This model is relationship-based access control (ReBAC), the model behind Google Zanzibar.

> [!NOTE]
> Peretyn is early and pre-1.0. Expect breaking changes between minor versions.

## Example

```ts
import { any, defineSchema, peretyn, type } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  document: type({
    relations: { owner: ['user'], viewer: ['user'] },
    permissions: { can_view: any('owner', 'viewer') },
  }),
});

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const { allowed } = await authz.check({
  subject: { type: 'user', id: 'alice' },
  relation: 'can_view',
  object: { type: 'document', id: 'roadmap' },
});
```

The SDK checks every type and relation name at compile time.

## Documentation

- [Quickstart](https://docs.peretyn.dev/quickstart): from an empty project to your first check.
- [Concepts](https://docs.peretyn.dev/concepts): schemas, tuples and checks.
- [SDK](https://docs.peretyn.dev/sdk) and [CLI](https://docs.peretyn.dev/cli) reference.
- [Self-hosting](https://docs.peretyn.dev/self-hosting): run the stack on your own infrastructure.

## Repository layout

| Path                 | What it is                                                |
| -------------------- | --------------------------------------------------------- |
| `packages/sdk`       | `@peretyn/sdk`, the TypeScript SDK                        |
| `packages/go-cli`    | The `peretyn` CLI                                         |
| `services/runtime`   | Go service that answers checks and stores tuples          |
| `services/control`   | Control plane API: organizations, projects, keys, schemas |
| `services/dashboard` | Next.js dashboard                                         |
| `services/docs`      | The documentation site                                    |
| `deploy`             | Compose stack for self-hosting                            |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Third-party code keeps its notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
