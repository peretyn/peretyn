import { parseTargetType, toExpr, type RelationReference } from './schema-expr.js';
import { validateSchema } from './schema-validation.js';

/** Another relation or permission on the same type, by name. */
export interface RelationRef {
  readonly kind: 'ref';
  readonly name: string;
}

/** `relation` on the objects linked through the `tupleset` relation. Built by `via`. */
export interface ViaExpr {
  readonly kind: 'via';
  readonly tupleset: string;
  readonly relation: string;
}

/** A union, intersection or difference. Built by `any`, `intersect` and `exclude`. */
export interface CombinatorExpr {
  readonly kind: 'union' | 'intersection' | 'difference';
  readonly children: readonly RelationExpr[];
}

/** A permission expression. */
export type RelationExpr = RelationRef | ViaExpr | CombinatorExpr;

/** A permission expression, or the name of a relation or permission on the same type. */
export type Permission = RelationExpr | string;

/** An object type. Build it with `type`. */
export interface TypeDef {
  /**
   * Direct relations, each mapped to the subjects that may hold it: a type
   * (`'user'`), every subject of a type (`'user:*'`) or a userset (`'team#member'`).
   */
  readonly relations?: Readonly<Record<string, readonly string[]>>;
  /** Computed permissions, each mapped to an expression over relations. */
  readonly permissions?: Readonly<Record<string, Permission>>;
}

/** A schema: object type name to `TypeDef`. Build it with `defineSchema`. */
export type PeretynSchema = Readonly<Record<string, TypeDef>>;

/** Union of the type names a schema declares. */
export type TypeNames<S extends PeretynSchema> = keyof S & string;

/** Direct relations of type `T`: the relations tuples can be written to. */
export type DirectRelationsOf<S extends PeretynSchema, T extends TypeNames<S>> = S[T] extends {
  relations?: infer R;
}
  ? keyof NonNullable<R> & string
  : never;

/** Computed permissions of type `T`. */
export type PermissionsOf<S extends PeretynSchema, T extends TypeNames<S>> = S[T] extends {
  permissions?: infer P;
}
  ? keyof NonNullable<P> & string
  : never;

/** Everything `check`, `expand` and the lookups accept on type `T`: relations and permissions. */
export type CheckRelationsOf<S extends PeretynSchema, T extends TypeNames<S>> =
  | DirectRelationsOf<S, T>
  | PermissionsOf<S, T>;

/** Declares an object type. Call it with no argument for a type that is only a subject. */
export function type<T extends TypeDef = TypeDef>(def: T = {} as T): T {
  return def;
}

/**
 * Validates a schema and returns it unchanged, keeping its literal type for
 * `peretyn<typeof schema>()`. Throws a `PeretynSchemaError` on a mistake the
 * runtime would reject, such as an unknown type or an undefined relation.
 */
export function defineSchema<S extends PeretynSchema>(schema: S): S {
  validateSchema(schema);
  return schema;
}

/** Granted when any operand grants it (`a or b`). */
export function any(...children: Permission[]): CombinatorExpr {
  return { kind: 'union', children: children.map(toExpr) };
}

/** Granted when every operand grants it (`a and b`). */
export function intersect(...children: Permission[]): CombinatorExpr {
  return { kind: 'intersection', children: children.map(toExpr) };
}

/** Granted by `left` unless `right` grants it (`left but not right`). */
export function exclude(left: Permission, right: Permission): CombinatorExpr {
  return { kind: 'difference', children: [toExpr(left), toExpr(right)] };
}

/**
 * Granted when the subject has `relation` on an object linked through the
 * `tupleset` relation (`relation from tupleset`), e.g. `via('tenant', 'admin')`.
 */
export function via(tupleset: string, relation: string): ViaExpr {
  return { kind: 'via', tupleset, relation };
}

const SCHEMA_VERSION = '1.1';

type RelationMetadata = Record<string, { directly_related_user_types: RelationReference[] }>;

/** An OpenFGA authorization model in its JSON form. */
export interface OpenFGAModel {
  schema_version: string;
  type_definitions: Array<{
    type: string;
    relations: Record<string, unknown>;
    metadata?: { relations: RelationMetadata };
  }>;
}

/** Compiles a schema to an OpenFGA authorization model. */
export function schemaToOpenFGA(schema: PeretynSchema): OpenFGAModel {
  validateSchema(schema);
  const type_definitions = Object.entries(schema).map(([typeName, def]) =>
    typeToOpenFGA(typeName, def),
  );
  return { schema_version: SCHEMA_VERSION, type_definitions };
}

function typeToOpenFGA(typeName: string, def: TypeDef): OpenFGAModel['type_definitions'][number] {
  const relations: Record<string, unknown> = {};
  const metadataRelations: RelationMetadata = {};

  const directRelations = def.relations ?? {};
  for (const [relName, targets] of Object.entries(directRelations)) {
    relations[relName] = { this: {} };
    metadataRelations[relName] = {
      directly_related_user_types: targets.map(parseTargetType),
    };
  }

  const permissions = def.permissions ?? {};
  for (const [permName, expr] of Object.entries(permissions)) {
    relations[permName] = exprToOpenFGA(toExpr(expr));
  }

  return { type: typeName, relations, metadata: { relations: metadataRelations } };
}

function exprToOpenFGA(expr: RelationExpr): unknown {
  switch (expr.kind) {
    case 'ref':
      return { computedUserset: { object: '', relation: expr.name } };
    case 'via':
      return {
        tupleToUserset: {
          tupleset: { object: '', relation: expr.tupleset },
          computedUserset: { object: '', relation: expr.relation },
        },
      };
    case 'union':
      return combinatorToOpenFGA('union', expr.children);
    case 'intersection':
      return combinatorToOpenFGA('intersection', expr.children);
    case 'difference':
      return differenceToOpenFGA(expr.children);
  }
}

function combinatorToOpenFGA(kind: 'union' | 'intersection', children: readonly RelationExpr[]) {
  const [onlyChild] = children;
  if (children.length === 1 && onlyChild) {
    return exprToOpenFGA(onlyChild);
  }
  return { [kind]: { child: children.map(exprToOpenFGA) } };
}

function differenceToOpenFGA(children: readonly RelationExpr[]): unknown {
  const [base, subtract] = children;
  if (!base || !subtract) {
    throw new Error('exclude(): requires two operands');
  }
  return {
    difference: {
      base: exprToOpenFGA(base),
      subtract: exprToOpenFGA(subtract),
    },
  };
}

/** Renders a schema in the OpenFGA DSL (`.fga`). */
export function schemaToDsl(schema: PeretynSchema): string {
  const lines: string[] = ['model', `  schema ${SCHEMA_VERSION}`, ''];
  for (const [typeName, def] of Object.entries(schema)) {
    lines.push(...typeToDsl(typeName, def));
  }
  return lines.join('\n');
}

function typeToDsl(typeName: string, def: TypeDef): string[] {
  const lines: string[] = [`type ${typeName}`];
  const direct = def.relations ?? {};
  const perms = def.permissions ?? {};
  if (Object.keys(direct).length === 0 && Object.keys(perms).length === 0) {
    return [...lines, ''];
  }
  lines.push('  relations');
  for (const [relName, targets] of Object.entries(direct)) {
    const sources = targets.map((t) => `[${t}]`).join(' or ');
    lines.push(`    define ${relName}: ${sources}`);
  }
  for (const [permName, expr] of Object.entries(perms)) {
    lines.push(`    define ${permName}: ${exprToDsl(toExpr(expr))}`);
  }
  return [...lines, ''];
}

function dslChild(expr: RelationExpr): string {
  const rendered = exprToDsl(expr);
  const isCompound =
    expr.kind === 'union' || expr.kind === 'intersection' || expr.kind === 'difference';
  return isCompound ? `(${rendered})` : rendered;
}

function exprToDsl(expr: RelationExpr): string {
  switch (expr.kind) {
    case 'ref':
      return expr.name;
    case 'via':
      return `${expr.relation} from ${expr.tupleset}`;
    case 'union':
      return expr.children.map(dslChild).join(' or ');
    case 'intersection':
      return expr.children.map(dslChild).join(' and ');
    case 'difference':
      return `${dslChild(expr.children[0]!)} but not ${dslChild(expr.children[1]!)}`;
  }
}
