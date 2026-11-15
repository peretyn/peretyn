import type { Permission, RelationExpr } from './schema.js';

const WILDCARD_SUFFIX = ':*';

export interface RelationReference {
  type: string;
  relation?: string;
  wildcard?: object;
}

export function toExpr(p: Permission): RelationExpr {
  if (typeof p === 'string') {
    return { kind: 'ref', name: p };
  }
  return p;
}

export function parseTargetType(target: string): RelationReference {
  if (target.endsWith(WILDCARD_SUFFIX)) {
    return { type: target.slice(0, -WILDCARD_SUFFIX.length), wildcard: {} };
  }
  const hashIdx = target.indexOf('#');
  if (hashIdx >= 0) {
    return { type: target.slice(0, hashIdx), relation: target.slice(hashIdx + 1) };
  }
  return { type: target };
}
