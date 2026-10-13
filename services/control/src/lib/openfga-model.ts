import { z } from 'zod';

export const openFGAModel = z
  .object({
    type_definitions: z.array(
      z
        .object({ type: z.string(), relations: z.record(z.string(), z.unknown()).optional() })
        .loose(),
    ),
  })
  .loose();

export type OpenFGAModel = z.infer<typeof openFGAModel>;

interface ModelDiff {
  addedTypes: string[];
  removedTypes: string[];
  changedTypes: Array<{ type: string; addedRelations: string[]; removedRelations: string[] }>;
  hasChanges: boolean;
}

type TypeIndex = Record<string, Record<string, unknown>>;
type ChangedType = ModelDiff['changedTypes'][number];

function findChangedType(
  name: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ChangedType | null {
  const beforeRelations = Object.keys(before);
  const afterRelations = Object.keys(after);
  const addedRelations = afterRelations.filter((r) => !beforeRelations.includes(r));
  const removedRelations = beforeRelations.filter((r) => !afterRelations.includes(r));
  if (addedRelations.length === 0 && removedRelations.length === 0) return null;
  return { type: name, addedRelations, removedRelations };
}

function findChangedTypes(prevTypes: TypeIndex, nextTypes: TypeIndex): ChangedType[] {
  const changedTypes: ChangedType[] = [];
  for (const [name, nextRelations] of Object.entries(nextTypes)) {
    const prevRelations = prevTypes[name];
    const changedType = prevRelations && findChangedType(name, prevRelations, nextRelations);
    if (changedType) changedTypes.push(changedType);
  }
  return changedTypes;
}

export function diffModels(prev: OpenFGAModel | null, next: OpenFGAModel): ModelDiff {
  const prevTypes = indexTypes(prev);
  const nextTypes = indexTypes(next);

  const addedTypes = Object.keys(nextTypes).filter((name) => !prevTypes[name]);
  const removedTypes = Object.keys(prevTypes).filter((name) => !(name in nextTypes));
  const changedTypes = findChangedTypes(prevTypes, nextTypes);

  const hasChanges = addedTypes.length > 0 || removedTypes.length > 0 || changedTypes.length > 0;
  return { addedTypes, removedTypes, changedTypes, hasChanges };
}

function indexTypes(model: OpenFGAModel | null): TypeIndex {
  const out: TypeIndex = {};
  for (const td of model?.type_definitions ?? []) out[td.type] = td.relations ?? {};
  return out;
}
