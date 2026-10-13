'use client';

import { useEffect, useRef, useState } from 'react';

import { Label } from '@peretyn/ui/components/label';
import { SuggestCombobox } from '@/components/project/suggest-combobox';
import type { SchemaShape } from '@/lib/control/schemas';
import type { Tuple } from '@/lib/control/types';

export const EMPTY_TUPLE: Tuple = { user: '', relation: '', object: '' };

export function useTupleDraft(sample: Tuple | null) {
  const [draft, setDraft] = useState(EMPTY_TUPLE);
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !sample) return;
    prefilled.current = true;
    setDraft(sample);
  }, [sample]);
  return [draft, setDraft] as const;
}

export function isComplete(tuple: Tuple) {
  return Boolean(tuple.user && tuple.relation && tuple.object);
}

export function TupleFields({
  idPrefix,
  tuple,
  onChange,
  shape,
}: {
  idPrefix: string;
  tuple: Tuple;
  onChange: (tuple: Tuple) => void;
  shape: SchemaShape;
}) {
  const fields = [
    { key: 'user', label: 'Subject', suggestions: shape.typePrefixes },
    { key: 'relation', label: 'Relation', suggestions: shape.relations },
    { key: 'object', label: 'Object', suggestions: shape.typePrefixes },
  ] as const;

  return fields.map(({ key, label, suggestions }) => {
    const id = `${idPrefix}-${label.toLowerCase()}`;
    return (
      <div key={key} className="flex flex-col gap-2">
        <Label htmlFor={id}>{label}</Label>
        <SuggestCombobox
          id={id}
          className="font-mono"
          value={tuple[key]}
          placeholder={shape.sample?.[key]}
          onValueChange={(value) => onChange({ ...tuple, [key]: value })}
          suggestions={suggestions}
        />
      </div>
    );
  });
}
