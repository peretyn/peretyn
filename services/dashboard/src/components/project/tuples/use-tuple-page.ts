import { useState } from 'react';
import { useDebouncedValue } from '@tanstack/react-pacer';

import { useTuples } from '@/lib/control/tuples';

const PAGE_SIZE = 10;
const FILTER_DEBOUNCE = { wait: 300 };

function emptyToUndefined(value: string): string | undefined {
  return value || undefined;
}

export function useTupleFilters() {
  const [objectFilter, setObjectFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [relationFilter, setRelationFilter] = useState('');

  const [object] = useDebouncedValue(objectFilter, FILTER_DEBOUNCE);
  const [user] = useDebouncedValue(userFilter, FILTER_DEBOUNCE);
  const [relation] = useDebouncedValue(relationFilter, FILTER_DEBOUNCE);

  return {
    inputs: {
      objectFilter,
      setObjectFilter,
      userFilter,
      setUserFilter,
      relationFilter,
      setRelationFilter,
    },
    debounced: { object, user, relation },
  };
}

function usePagination(resetKey: string) {
  const [tokenHistory, setTokenHistory] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);

  const [previousResetKey, setPreviousResetKey] = useState(resetKey);
  if (resetKey !== previousResetKey) {
    setPreviousResetKey(resetKey);
    setPage(0);
    setTokenHistory([undefined]);
  }

  const goNext = (continuationToken: string) => {
    setTokenHistory((history) => [...history.slice(0, page + 1), continuationToken]);
    setPage((current) => current + 1);
  };
  const goPrevious = () => setPage((current) => Math.max(0, current - 1));

  return { page, continuationToken: tokenHistory[page], goNext, goPrevious };
}

type DebouncedFilters = ReturnType<typeof useTupleFilters>['debounced'];

function useFilteredTuples(
  projectId: string,
  environmentId: string,
  { filters, continuationToken }: { filters: DebouncedFilters; continuationToken?: string },
) {
  return useTuples(projectId, environmentId, {
    object: emptyToUndefined(filters.object),
    user: emptyToUndefined(filters.user),
    relation: emptyToUndefined(filters.relation),
    pageSize: PAGE_SIZE,
    continuationToken,
  });
}

export function useTuplePage(projectId: string, environmentId: string) {
  const { inputs, debounced } = useTupleFilters();
  const pagination = usePagination(`${debounced.object}|${debounced.user}|${debounced.relation}`);
  const query = useFilteredTuples(projectId, environmentId, {
    filters: debounced,
    continuationToken: pagination.continuationToken,
  });

  const nextToken = query.isPlaceholderData ? undefined : query.data?.continuationToken;
  const goNext = () => {
    if (nextToken) pagination.goNext(nextToken);
  };

  return {
    filters: inputs,
    query,
    page: pagination.page,
    hasNext: Boolean(nextToken),
    goNext,
    goPrevious: pagination.goPrevious,
  };
}

export type TuplePage = ReturnType<typeof useTuplePage>;
