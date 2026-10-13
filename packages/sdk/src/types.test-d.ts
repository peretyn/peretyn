import { defineSchema, type, any, via, peretyn } from './index.js';

export const schema = defineSchema({
  user: type(),
  tenant: type({
    relations: { admin: ['user'], member: ['user', 'tenant#admin'] },
  }),
  document: type({
    relations: {
      tenant: ['tenant'],
      owner: ['user'],
      editor: ['user', 'tenant#admin'],
      viewer: ['user', 'tenant#member'],
    },
    permissions: {
      can_edit: any('owner', 'editor'),
      can_view: any('owner', 'editor', 'viewer'),
      can_delete: any('owner', via('tenant', 'admin')),
    },
  }),
});

type Schema = typeof schema;

const client = peretyn<Schema>({ token: 't' });

void client.check({
  subject: { type: 'user', id: 'u' },
  relation: 'can_view',
  object: { type: 'document', id: 'd' },
});
void client.check({
  subject: { type: 'user', id: 'u' },
  relation: 'owner',
  object: { type: 'document', id: 'd' },
});
void client.check({
  subject: { type: 'tenant', id: 't', relation: 'admin' },
  relation: 'admin',
  object: { type: 'tenant', id: 't' },
});

void client.check({
  subject: { type: 'user', id: 'u' },
  // @ts-expect-error - typo'd permission must be rejected.
  relation: 'can_veiw',
  object: { type: 'document', id: 'd' },
});

void client.check({
  subject: { type: 'user', id: 'u' },
  // @ts-expect-error - relation that does not exist on `document` must be rejected.
  relation: 'admin',
  object: { type: 'document', id: 'd' },
});

void client.check({
  subject: { type: 'user', id: 'u' },
  // @ts-expect-error - unknown object type must be rejected.
  relation: 'can_view',
  // @ts-expect-error - unknown object type must be rejected.
  object: { type: 'widget', id: 'd' },
});

void client.check({
  // @ts-expect-error - unknown subject type must be rejected.
  subject: { type: 'robot', id: 'r' },
  relation: 'can_view',
  object: { type: 'document', id: 'd' },
});

void client.check({
  // @ts-expect-error - subject userset relation must exist on the subject type.
  subject: { type: 'tenant', id: 't', relation: 'owner' },
  relation: 'can_view',
  object: { type: 'document', id: 'd' },
});

void client.write({
  writes: [
    {
      subject: { type: 'user', id: 'u' },
      relation: 'owner',
      object: { type: 'document', id: 'd' },
    },
    {
      subject: { type: 'tenant', id: 't', relation: 'admin' },
      relation: 'editor',
      object: { type: 'document', id: 'd' },
    },
    { subject: { type: 'user', id: 'e' }, relation: 'admin', object: { type: 'tenant', id: 't' } },
  ],
});

void client.write({
  writes: [
    {
      subject: { type: 'user', id: 'u' },
      // @ts-expect-error - cannot write a tuple to a computed permission.
      relation: 'can_edit',
      object: { type: 'document', id: 'd' },
    },
  ],
});

void client.write({
  writes: [
    // @ts-expect-error - unknown relation on write must be rejected.
    { subject: { type: 'user', id: 'u' }, relation: 'nope', object: { type: 'document', id: 'd' } },
  ],
});

void client.write({
  deletes: [
    {
      subject: { type: 'user', id: 'u' },
      // @ts-expect-error - deletes are checked the same way as writes.
      relation: 'edtor',
      object: { type: 'document', id: 'd' },
    },
  ],
});

// @ts-expect-error - write() with neither writes nor deletes must be rejected at compile time.
void client.write({});

void client.lookupResources({
  subject: { type: 'user', id: 'u' },
  relation: 'can_view',
  resourceType: 'document',
});
void client.lookupSubjects({
  resource: { type: 'document', id: 'd' },
  relation: 'can_view',
  subjectType: 'user',
});
void client.expand({ relation: 'can_view', object: { type: 'document', id: 'd' } });

void client.lookupResources({
  subject: { type: 'user', id: 'u' },
  // @ts-expect-error - lookupResources relation must be valid on resourceType.
  relation: 'bogus',
  resourceType: 'document',
});

void client.assert({
  subject: { type: 'user', id: 'u' },
  relation: 'can_edit',
  object: { type: 'document', id: 'd' },
});

void client.assert({
  subject: { type: 'user', id: 'u' },
  // @ts-expect-error - assert relation must be valid on the object type.
  relation: 'can_eddit',
  object: { type: 'document', id: 'd' },
});

void client.batchCheck([
  {
    subject: { type: 'user', id: 'u' },
    relation: 'can_view',
    object: { type: 'document', id: 'd1' },
  },
  {
    subject: { type: 'tenant', id: 't', relation: 'admin' },
    relation: 'admin',
    object: { type: 'tenant', id: 't' },
  },
]);

void client.batchCheck([
  // @ts-expect-error - batchCheck item relation must be valid on its object type.
  { subject: { type: 'user', id: 'u' }, relation: 'nope', object: { type: 'document', id: 'd' } },
]);

type EchoedCheck = Awaited<
  ReturnType<typeof client.batchCheck<readonly ['document', 'tenant']>>
>[number]['check'];

export const echoedTenantCheck: EchoedCheck = {
  subject: { type: 'user', id: 'u' },
  relation: 'admin',
  object: { type: 'tenant', id: 't' },
};

// @ts-expect-error - an echoed tenant check never carries a document permission.
export const echoedMismatchedCheck: EchoedCheck = {
  subject: { type: 'user', id: 'u' },
  relation: 'can_view',
  object: { type: 'tenant', id: 't' },
};

void client.check({
  subject: { type: 'user', id: 'u' },
  relation: 'can_view',
  object: { type: 'document', id: 'd' },
  contextualTuples: [
    {
      subject: { type: 'user', id: 'u' },
      relation: 'viewer',
      object: { type: 'document', id: 'd' },
    },
  ],
});

void client.check({
  subject: { type: 'user', id: 'u' },
  relation: 'can_view',
  object: { type: 'document', id: 'd' },
  contextualTuples: [
    // @ts-expect-error - contextual tuple relation must be a valid direct relation.
    {
      subject: { type: 'user', id: 'u' },
      relation: 'vewer',
      object: { type: 'document', id: 'd' },
    },
  ],
});

const loose = peretyn({ token: 't' });
void loose.check({
  subject: { type: 'anything', id: 'x' },
  relation: 'whatever',
  object: { type: 'thing', id: 'y' },
});
