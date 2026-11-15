import { describe, expect, it } from 'vitest';
import {
  any,
  exclude,
  intersect,
  PeretynSchemaError,
  schemaToOpenFGA,
  type,
  via,
  type PeretynSchema,
} from './index.js';

function compileError(schema: PeretynSchema): PeretynSchemaError {
  try {
    schemaToOpenFGA(schema);
  } catch (error) {
    if (error instanceof PeretynSchemaError) return error;
    throw error;
  }
  throw new Error('expected the schema to be rejected');
}

describe('schema validation', () => {
  describe('rejects', () => {
    it.each<{ name: string; schema: PeretynSchema; message: RegExp; token: string }>([
      {
        name: 'a relation target of an unknown type',
        schema: { user: type(), doc: type({ relations: { owner: ['usr'] } }) },
        message: /type "doc" relation "owner": "usr" is not a type in the schema/,
        token: 'usr',
      },
      {
        name: 'a wildcard target of an unknown type',
        schema: { user: type(), doc: type({ relations: { viewer: ['usr:*'] } }) },
        message: /type "doc" relation "viewer": "usr" is not a type in the schema/,
        token: 'usr:*',
      },
      {
        name: 'a userset target on an undefined relation',
        schema: {
          user: type(),
          team: type({ relations: { member: ['user'] } }),
          doc: type({ relations: { viewer: ['team#ghost'] } }),
        },
        message: /type "doc" relation "viewer": "ghost" is not a relation or permission of "team"/,
        token: 'team#ghost',
      },
      {
        name: 'a permission that refers to an undefined relation',
        schema: {
          user: type(),
          doc: type({
            relations: { owner: ['user'] },
            permissions: { view: any('owner', 'ghost') },
          }),
        },
        message: /type "doc" permission "view": "ghost" is not a relation or permission of "doc"/,
        token: 'ghost',
      },
      {
        name: 'a permission that refers only to itself',
        schema: { user: type(), doc: type({ permissions: { view: 'view' } }) },
        message: /type "doc" permission "view": a permission can't refer to itself/,
        token: 'view',
      },
      {
        name: 'permissions that refer to each other in a cycle',
        schema: {
          user: type(),
          doc: type({
            relations: { owner: ['user'] },
            permissions: { edit: any('owner', 'view'), view: 'edit' },
          }),
        },
        message: /type "doc" permission "edit": it depends on itself through "view"/,
        token: 'view',
      },
      {
        name: 'a via through an undefined relation',
        schema: { user: type(), doc: type({ permissions: { view: via('parent', 'view') } }) },
        message: /type "doc" permission "view": "parent" is not a relation of "doc"/,
        token: 'parent',
      },
      {
        name: 'a via through a permission',
        schema: {
          user: type(),
          folder: type({ relations: { viewer: ['user'] } }),
          doc: type({
            relations: { folder: ['folder'] },
            permissions: { in_folder: 'folder', view: via('in_folder', 'viewer') },
          }),
        },
        message:
          /type "doc" permission "view": via\(\) goes through "in_folder", which must be a relation, not a permission/,
        token: 'in_folder',
      },
      {
        name: 'a via through a relation with a userset target',
        schema: {
          user: type(),
          folder: type({ relations: { viewer: ['user'] } }),
          doc: type({
            relations: { parent: ['folder#viewer'] },
            permissions: { view: via('parent', 'viewer') },
          }),
        },
        message:
          /type "doc" relation "parent": via\(\) goes through it, so its targets must be plain types, not "folder#viewer"/,
        token: 'folder#viewer',
      },
      {
        name: 'a via to a relation that no target type defines',
        schema: {
          user: type(),
          folder: type({ relations: { owner: ['user'] } }),
          doc: type({
            relations: { parent: ['folder'] },
            permissions: { view: via('parent', 'viewer') },
          }),
        },
        message:
          /type "doc" permission "view": "viewer" is not a relation or permission of "folder"/,
        token: 'viewer',
      },
      {
        name: 'a name declared as both a relation and a permission',
        schema: {
          user: type(),
          doc: type({ relations: { view: ['user'] }, permissions: { view: 'view' } }),
        },
        message: /type "doc": "view" is declared as both a relation and a permission/,
        token: 'view',
      },
      {
        name: 'a reserved type name',
        schema: { self: type() },
        message: /type "self": "self" is a reserved name/,
        token: 'self',
      },
      {
        name: 'a relation name with a forbidden character',
        schema: { user: type(), doc: type({ relations: { 'can view': ['user'] } }) },
        message: /type "doc": "can view" can't contain spaces, ":", "#" or "@"/,
        token: 'can view',
      },
      {
        name: 'a permission that can never be granted',
        schema: {
          user: type(),
          folder: type({
            relations: { parent: ['folder'] },
            permissions: { view: via('parent', 'view') },
          }),
        },
        message:
          /type "folder" permission "view": it can never be granted; no path leads to a relation/,
        token: 'view',
      },
      {
        name: 'an empty any()',
        schema: { user: type(), doc: type({ permissions: { view: any() } }) },
        message: /type "doc" permission "view": any\(\) needs at least one operand/,
        token: 'view',
      },
      {
        name: 'an empty intersect()',
        schema: { user: type(), doc: type({ permissions: { view: intersect() } }) },
        message: /type "doc" permission "view": intersect\(\) needs at least one operand/,
        token: 'view',
      },
    ])('$name', ({ schema, message, token }) => {
      const error = compileError(schema);
      expect(error.message).toMatch(message);
      expect(error.token).toBe(token);
    });
  });

  describe('compiles', () => {
    it('a single-operand any() to the operand itself', () => {
      const model = schemaToOpenFGA({
        user: type(),
        doc: type({ relations: { admin: ['user'] }, permissions: { manage: any('admin') } }),
      });
      const doc = model.type_definitions.find((t) => t.type === 'doc');
      expect(doc?.relations.manage).toEqual({ computedUserset: { object: '', relation: 'admin' } });
    });

    it('a single-operand intersect() to the operand itself', () => {
      const model = schemaToOpenFGA({
        user: type(),
        doc: type({ relations: { admin: ['user'] }, permissions: { manage: intersect('admin') } }),
      });
      const doc = model.type_definitions.find((t) => t.type === 'doc');
      expect(doc?.relations.manage).toEqual({ computedUserset: { object: '', relation: 'admin' } });
    });

    it('a recursive via that has a path to a relation', () => {
      expect(() =>
        schemaToOpenFGA({
          user: type(),
          folder: type({
            relations: { parent: ['folder'], viewer: ['user'] },
            permissions: {
              view: any('viewer', via('parent', 'view')),
              hidden: exclude('view', 'viewer'),
            },
          }),
        }),
      ).not.toThrow();
    });
  });
});
