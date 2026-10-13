import { useQuery } from '@tanstack/react-query';
import { controlFetch } from './client';
import { controlKeys } from './keys';
import type { SchemaVersion, Tuple } from './types';

export function useLatestSchema(projectId: string, environmentId: string | undefined) {
  return useQuery({
    queryKey: controlKeys.schemas(projectId, environmentId),
    enabled: Boolean(environmentId),
    queryFn: () =>
      controlFetch<{ schemas: SchemaVersion[] }>(
        `/projects/${projectId}/environments/${environmentId}/schemas`,
      ),
    select: (data) => data.schemas[0] ?? null,
  });
}

export function useSchemaShape(projectId: string, environmentId: string | undefined) {
  const { data: latest } = useLatestSchema(projectId, environmentId);

  const definitions = latest?.modelJson.type_definitions ?? [];
  const types = definitions.map((definition) => definition.type);
  const relations = Array.from(
    new Set(definitions.flatMap((definition) => Object.keys(definition.relations ?? {}))),
  );

  const objectDef = definitions.find(
    (definition) => Object.keys(definition.relations ?? {}).length > 0,
  );
  const sample: Tuple | null = objectDef
    ? {
        user: `${types.includes('user') ? 'user' : types[0]}:alice`,
        relation: Object.keys(objectDef.relations ?? {})[0] ?? '',
        object: `${objectDef.type}:example`,
      }
    : null;

  return { typePrefixes: types.map((type) => `${type}:`), relations, sample };
}

export type SchemaShape = ReturnType<typeof useSchemaShape>;
