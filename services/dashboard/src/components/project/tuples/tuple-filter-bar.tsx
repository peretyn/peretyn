'use client';

import { SuggestCombobox } from '@/components/project/suggest-combobox';
import type { SchemaShape } from '@/lib/control/schemas';
import type { TuplePage } from './use-tuple-page';

export function TupleFilterBar({
  filters,
  shape,
}: {
  filters: TuplePage['filters'];
  shape: SchemaShape;
}) {
  const { typePrefixes, relations, sample } = shape;
  return (
    <div className="flex flex-wrap gap-2">
      <SuggestCombobox
        className="min-w-40 flex-1 font-mono"
        placeholder={`object: ${sample?.object ?? 'type:id'}`}
        value={filters.objectFilter}
        onValueChange={filters.setObjectFilter}
        suggestions={typePrefixes}
      />
      <SuggestCombobox
        className="w-40 shrink-0 font-mono"
        placeholder={sample?.relation ?? 'relation'}
        value={filters.relationFilter}
        onValueChange={filters.setRelationFilter}
        suggestions={relations}
      />
      <SuggestCombobox
        className="min-w-40 flex-1 font-mono"
        placeholder={`subject: ${sample?.user ?? 'user:id'}`}
        value={filters.userFilter}
        onValueChange={filters.setUserFilter}
        suggestions={typePrefixes}
      />
    </div>
  );
}
