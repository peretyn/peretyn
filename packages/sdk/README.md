# @peretyn/sdk

Typed TypeScript client for the Peretyn runtime.

```sh
npm install @peretyn/sdk
```

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

See the [SDK guides](https://docs.peretyn.dev/sdk) for configuration, checks,
tuples and errors.
