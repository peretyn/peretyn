# @peretyn/sdk

Typed TypeScript client for the Peretyn runtime.

```ts
import { defineSchema, type, any, peretyn } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  document: type({
    relations: { owner: ['user'], editor: ['user'] },
    permissions: { can_edit: any('owner', 'editor') },
  }),
});

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

const { allowed } = await authz.check({
  subject: { type: 'user', id: 'u_42' },
  relation: 'can_edit',
  object: { type: 'document', id: 'doc_99' },
});
```

With the schema type argument, every `type` and `relation` is checked at
compile time.

## Configuration

| Option           | Default                                                    |
| ---------------- | ---------------------------------------------------------- |
| `token`          | required; an environment key, `prn_live_…` or `prn_test_…` |
| `baseUrl`        | `$PERETYN_RUNTIME_URL`, else `http://localhost:8080`       |
| `timeoutMs`      | `1000`; `0` disables                                       |
| `retries`        | `2`; `0` disables                                          |
| `retryBackoffMs` | `50`                                                       |

The token selects the environment's store, so there is no store id to pass.
An invalid `baseUrl` throws when the client is created.

## Timeouts and retries

`timeoutMs` is the budget for a whole call: every attempt and reading the
response. A check costs the runtime tens of microseconds, so the budget is
spent on the network; raise it for `lookupResources` over large result sets.

Network errors, 429 and 5xx (except 504) are retried within the budget. Writes
are retried only when idempotent, i.e. not `strict` and with `onDuplicate` /
`onMissing` left at `'ignore'`.

## Errors

- `PeretynError`: the runtime answered with an error status (`status`, `body`).
  `assert` throws it with status 403 on a deny.
- `PeretynUnavailableError`: the runtime could not be reached.
- `PeretynTimeoutError`: the call ran out of `timeoutMs`. It extends
  `PeretynUnavailableError`.

Whether authorization fails open or closed during an outage is your call, so
the SDK throws instead of guessing:

```ts
import { PeretynUnavailableError } from '@peretyn/sdk';

try {
  return (await authz.check({ ... })).allowed;
} catch (err) {
  if (err instanceof PeretynUnavailableError) return false; // fail closed
  throw err;
}
```
