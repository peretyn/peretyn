import type { CombinatorExpr, PeretynSchema, RelationExpr, TypeDef, ViaExpr } from './schema.js';
import { parseTargetType, toExpr } from './schema-expr.js';

const RESERVED_NAMES = new Set(['self', 'this']);
const FORBIDDEN_NAME_CHARACTERS = /[\s:#@]/;
const MAX_TYPE_NAME_LENGTH = 254;
const MAX_MEMBER_NAME_LENGTH = 50;
const BARE_WILDCARD = '*';
const OPERATOR_NAMES: Record<CombinatorExpr['kind'], string> = {
  union: 'any',
  intersection: 'intersect',
  difference: 'exclude',
};

type MemberKind = 'relation' | 'permission';

interface SchemaLocation {
  readonly typeName: string;
  readonly member?: { readonly kind: MemberKind; readonly name: string };
  readonly token: string;
}

interface PermissionSite {
  readonly typeName: string;
  readonly name: string;
}

interface Member {
  readonly typeName: string;
  readonly kind: MemberKind;
  readonly name: string;
}

/** A schema mistake, located by type, relation or permission, and the offending name. */
export class PeretynSchemaError extends Error {
  /** The type the mistake is in. */
  readonly typeName: string;
  /** The name or target that is wrong, as written in the schema. */
  readonly token: string;
  constructor(location: SchemaLocation, detail: string) {
    super(`Peretyn schema: ${describeLocation(location)}: ${detail}`);
    this.name = 'PeretynSchemaError';
    this.typeName = location.typeName;
    this.token = location.token;
  }
}

function describeLocation({ typeName, member }: SchemaLocation): string {
  const where = `type "${typeName}"`;
  return member ? `${where} ${member.kind} "${member.name}"` : where;
}

export function validateSchema(schema: PeretynSchema): void {
  for (const [typeName, def] of Object.entries(schema)) {
    validateType(schema, typeName, def);
  }
  for (const [typeName, def] of Object.entries(schema)) {
    validateNoCycles(typeName, def);
  }
  validateEveryMemberCanBeGranted(schema);
}

function validateType(schema: PeretynSchema, typeName: string, def: TypeDef): void {
  validateName(typeName, { typeName, token: typeName }, MAX_TYPE_NAME_LENGTH);
  validateMemberNames(typeName, def);
  for (const [name, targets] of Object.entries(def.relations ?? {})) {
    validateRelationTargets(
      schema,
      { typeName, member: { kind: 'relation', name }, token: name },
      targets,
    );
  }
  for (const [name, permission] of Object.entries(def.permissions ?? {})) {
    validateExpr(schema, { typeName, name }, toExpr(permission));
  }
}

function validateName(name: string, location: SchemaLocation, maxLength: number): void {
  if (RESERVED_NAMES.has(name)) {
    throw new PeretynSchemaError(location, `"${name}" is a reserved name`);
  }
  if (name.length === 0 || name.length > maxLength) {
    throw new PeretynSchemaError(location, `"${name}" must be 1 to ${maxLength} characters long`);
  }
  if (FORBIDDEN_NAME_CHARACTERS.test(name)) {
    throw new PeretynSchemaError(location, `"${name}" can't contain spaces, ":", "#" or "@"`);
  }
}

function validateMemberNames(typeName: string, def: TypeDef): void {
  const relationNames = Object.keys(def.relations ?? {});
  const permissionNames = Object.keys(def.permissions ?? {});
  for (const name of [...relationNames, ...permissionNames]) {
    validateName(name, { typeName, token: name }, MAX_MEMBER_NAME_LENGTH);
  }
  const clash = relationNames.find((name) => permissionNames.includes(name));
  if (clash !== undefined) {
    throw new PeretynSchemaError(
      { typeName, token: clash },
      `"${clash}" is declared as both a relation and a permission`,
    );
  }
}

function validateRelationTargets(
  schema: PeretynSchema,
  location: SchemaLocation,
  targets: readonly string[],
): void {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new PeretynSchemaError(location, 'must declare at least one target type, e.g. ["user"]');
  }
  for (const target of targets) {
    validateTarget(schema, { ...location, token: target }, target);
  }
}

function validateTarget(schema: PeretynSchema, location: SchemaLocation, target: string): void {
  if (target === BARE_WILDCARD) {
    throw new PeretynSchemaError(location, 'has a bare "*" target; name the type, e.g. "user:*"');
  }
  const reference = parseTargetType(target);
  if (!Object.hasOwn(schema, reference.type)) {
    throw new PeretynSchemaError(location, `"${reference.type}" is not a type in the schema`);
  }
  if (reference.relation !== undefined && !hasMember(schema, reference.type, reference.relation)) {
    throw new PeretynSchemaError(location, notAMemberOf(reference.relation, [reference.type]));
  }
}

function validateExpr(schema: PeretynSchema, site: PermissionSite, expr: RelationExpr): void {
  switch (expr.kind) {
    case 'ref':
      return validateRef(schema, site, expr.name);
    case 'via':
      return validateVia(schema, site, expr);
    default:
      return validateCombinator(schema, site, expr);
  }
}

function validateRef(schema: PeretynSchema, site: PermissionSite, name: string): void {
  if (name === site.name) {
    throw new PeretynSchemaError(atPermission(site, name), "a permission can't refer to itself");
  }
  if (!hasMember(schema, site.typeName, name)) {
    throw new PeretynSchemaError(atPermission(site, name), notAMemberOf(name, [site.typeName]));
  }
}

function validateCombinator(
  schema: PeretynSchema,
  site: PermissionSite,
  expr: CombinatorExpr,
): void {
  if (expr.children.length === 0) {
    throw new PeretynSchemaError(
      atPermission(site, site.name),
      `${OPERATOR_NAMES[expr.kind]}() needs at least one operand`,
    );
  }
  for (const child of expr.children) {
    validateExpr(schema, site, child);
  }
}

function validateVia(schema: PeretynSchema, site: PermissionSite, { tupleset, relation }: ViaExpr) {
  const targets = tuplesetTargets(schema, site, tupleset);
  const targetTypes = targets.map((target) => parseTargetType(target).type);
  if (!targetTypes.some((targetType) => hasMember(schema, targetType, relation))) {
    throw new PeretynSchemaError(atPermission(site, relation), notAMemberOf(relation, targetTypes));
  }
}

function tuplesetTargets(
  schema: PeretynSchema,
  site: PermissionSite,
  tupleset: string,
): readonly string[] {
  const def = schema[site.typeName] ?? {};
  const targets = ownRelationTargets(def, tupleset);
  if (targets === undefined) {
    throw new PeretynSchemaError(
      atPermission(site, tupleset),
      missingTuplesetDetail(def, site, tupleset),
    );
  }
  validatePlainTargets(site.typeName, tupleset, targets);
  return targets;
}

function missingTuplesetDetail(def: TypeDef, site: PermissionSite, tupleset: string): string {
  if (ownPermission(def, tupleset) !== undefined) {
    return `via() goes through "${tupleset}", which must be a relation, not a permission`;
  }
  return `"${tupleset}" is not a relation of "${site.typeName}"`;
}

function validatePlainTargets(
  typeName: string,
  tupleset: string,
  targets: readonly string[],
): void {
  const nonPlain = targets.find((target) => isPlainType(target) === false);
  if (nonPlain === undefined) return;
  throw new PeretynSchemaError(
    { typeName, member: { kind: 'relation', name: tupleset }, token: nonPlain },
    `via() goes through it, so its targets must be plain types, not "${nonPlain}"`,
  );
}

function isPlainType(target: string): boolean {
  const reference = parseTargetType(target);
  return reference.relation === undefined && reference.wildcard === undefined;
}

function validateNoCycles(typeName: string, def: TypeDef): void {
  for (const [name, permission] of Object.entries(def.permissions ?? {})) {
    const through = referencedNames(toExpr(permission)).find((referenced) =>
      dependsOn(def, { from: referenced, target: name }, new Set()),
    );
    if (through !== undefined) {
      throw new PeretynSchemaError(
        atPermission({ typeName, name }, through),
        `it depends on itself through "${through}"`,
      );
    }
  }
}

function referencedNames(expr: RelationExpr): string[] {
  if (expr.kind === 'ref') return [expr.name];
  if (expr.kind === 'via') return [];
  return expr.children.flatMap(referencedNames);
}

function dependsOn(
  def: TypeDef,
  edge: { from: string; target: string },
  visited: Set<string>,
): boolean {
  if (visited.has(edge.from)) return false;
  visited.add(edge.from);
  const permission = ownPermission(def, edge.from);
  if (permission === undefined) return false;
  return referencedNames(toExpr(permission)).some(
    (name) => name === edge.target || dependsOn(def, { from: name, target: edge.target }, visited),
  );
}

function validateEveryMemberCanBeGranted(schema: PeretynSchema): void {
  const grantable = findGrantableMembers(schema);
  const ungrantable = listMembers(schema).find((member) => !grantable.has(memberKey(member)));
  if (ungrantable === undefined) return;
  throw new PeretynSchemaError(
    { typeName: ungrantable.typeName, member: ungrantable, token: ungrantable.name },
    'it can never be granted; no path leads to a relation that tuples can be written to',
  );
}

function findGrantableMembers(schema: PeretynSchema): Set<string> {
  const grantable = new Set<string>();
  const members = listMembers(schema);
  let hasGrown = true;
  while (hasGrown) {
    const newlyGrantable = members.filter(
      (member) => !grantable.has(memberKey(member)) && canBeGranted(schema, member, grantable),
    );
    newlyGrantable.forEach((member) => grantable.add(memberKey(member)));
    hasGrown = newlyGrantable.length > 0;
  }
  return grantable;
}

function canBeGranted(schema: PeretynSchema, member: Member, grantable: Set<string>): boolean {
  const def = schema[member.typeName] ?? {};
  if (member.kind === 'relation') {
    return (ownRelationTargets(def, member.name) ?? []).some((target) => {
      const reference = parseTargetType(target);
      return (
        reference.relation === undefined || grantable.has(key(reference.type, reference.relation))
      );
    });
  }
  const permission = ownPermission(def, member.name);
  return (
    permission !== undefined &&
    isExprGrantable(schema, { typeName: member.typeName, grantable }, toExpr(permission))
  );
}

function isExprGrantable(
  schema: PeretynSchema,
  scope: { typeName: string; grantable: Set<string> },
  expr: RelationExpr,
): boolean {
  switch (expr.kind) {
    case 'ref':
      return scope.grantable.has(key(scope.typeName, expr.name));
    case 'via':
      return (ownRelationTargets(schema[scope.typeName] ?? {}, expr.tupleset) ?? []).some(
        (target) => scope.grantable.has(key(parseTargetType(target).type, expr.relation)),
      );
    case 'union':
      return expr.children.some((child) => isExprGrantable(schema, scope, child));
    default:
      return expr.children.every((child) => isExprGrantable(schema, scope, child));
  }
}

function listMembers(schema: PeretynSchema): Member[] {
  return Object.entries(schema).flatMap(([typeName, def]) => [
    ...Object.keys(def.relations ?? {}).map((name) => ({
      typeName,
      kind: 'relation' as const,
      name,
    })),
    ...Object.keys(def.permissions ?? {}).map((name) => ({
      typeName,
      kind: 'permission' as const,
      name,
    })),
  ]);
}

function memberKey(member: Member): string {
  return key(member.typeName, member.name);
}

function key(typeName: string, name: string): string {
  return `${typeName}#${name}`;
}

function ownRelationTargets(def: TypeDef, name: string): readonly string[] | undefined {
  return def.relations && Object.hasOwn(def.relations, name) ? def.relations[name] : undefined;
}

function ownPermission(def: TypeDef, name: string) {
  return def.permissions && Object.hasOwn(def.permissions, name)
    ? def.permissions[name]
    : undefined;
}

function hasMember(schema: PeretynSchema, typeName: string, name: string): boolean {
  const def = Object.hasOwn(schema, typeName) ? schema[typeName] : undefined;
  if (def === undefined) return false;
  return Object.hasOwn(def.relations ?? {}, name) || Object.hasOwn(def.permissions ?? {}, name);
}

function notAMemberOf(name: string, typeNames: readonly string[]): string {
  const owners = typeNames.map((typeName) => `"${typeName}"`).join(' or ');
  return `"${name}" is not a relation or permission of ${owners}`;
}

function atPermission(site: PermissionSite, token: string): SchemaLocation {
  return { typeName: site.typeName, member: { kind: 'permission', name: site.name }, token };
}
