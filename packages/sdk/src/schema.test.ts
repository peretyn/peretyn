import { describe, expect, it } from 'vitest';
import {
  any,
  defineSchema,
  exclude,
  intersect,
  schemaToDsl,
  schemaToOpenFGA,
  type,
  via,
} from './index.js';

describe('defineSchema', () => {
  it('compiles a representative ReBAC model to OpenFGA JSON', () => {
    const schema = defineSchema({
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

    const model = schemaToOpenFGA(schema);
    expect(model.schema_version).toBe('1.1');
    expect(model.type_definitions.map((t) => t.type)).toEqual(['user', 'tenant', 'document']);
    const document = model.type_definitions.find((t) => t.type === 'document')!;
    expect(document.relations).toHaveProperty('can_edit');
    expect(document.relations).toHaveProperty('can_delete');
  });

  it('round-trips through the DSL renderer', () => {
    const schema = defineSchema({
      user: type(),
      doc: type({
        relations: { owner: ['user'], editor: ['user'] },
        permissions: { can_write: any('owner', 'editor') },
      }),
    });
    const dslText = schemaToDsl(schema);
    expect(dslText).toContain('type doc');
    expect(dslText).toContain('define owner: [user]');
    expect(dslText).toContain('define can_write: owner or editor');
  });

  it('supports intersect and exclude', () => {
    const schema = defineSchema({
      user: type(),
      doc: type({
        relations: { owner: ['user'], blocked: ['user'], reader: ['user'] },
        permissions: {
          can_share: intersect('owner', exclude('reader', 'blocked')),
        },
      }),
    });
    const dslText = schemaToDsl(schema);
    expect(dslText).toContain('define can_share: owner and (reader but not blocked)');
  });

  it('parenthesises compound children so the rendering matches the model', () => {
    const schema = defineSchema({
      user: type(),
      doc: type({
        relations: { owner: ['user'], reader: ['user'], blocked: ['user'] },
        permissions: {
          minus: exclude(any('owner', 'reader'), 'blocked'),
          mixed: any('owner', intersect('reader', 'blocked')),
        },
      }),
    });
    const dslText = schemaToDsl(schema);
    expect(dslText).toContain('define minus: (owner or reader) but not blocked');
    expect(dslText).toContain('define mixed: owner or (reader and blocked)');
  });

  it('compiles a typed wildcard target', () => {
    const schema = defineSchema({
      user: type(),
      doc: type({ relations: { viewer: ['user', 'user:*'] } }),
    });
    const doc = schemaToOpenFGA(schema).type_definitions.find((t) => t.type === 'doc');
    expect(doc?.metadata?.relations.viewer?.directly_related_user_types).toEqual([
      { type: 'user' },
      { type: 'user', wildcard: {} },
    ]);
  });

  it('rejects a bare "*" target', () => {
    expect(() =>
      defineSchema({ user: type(), doc: type({ relations: { viewer: ['*'] } }) }),
    ).toThrowError(/"\*".*"user:\*"/);
  });

  it('rejects relations declared with no targets', () => {
    expect(() => defineSchema({ user: type({ relations: { broken: [] } }) })).toThrowError(
      /at least one target/,
    );
  });
});
