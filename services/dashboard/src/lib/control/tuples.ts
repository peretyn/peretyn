import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { controlFetch } from './client';
import { controlKeys } from './keys';
import type { Tuple } from './types';

type TupleFilters = {
  object?: string;
  user?: string;
  relation?: string;
  pageSize?: number;
  continuationToken?: string;
};

export function useTuples(
  projectId: string,
  environmentId: string | undefined,
  filters: TupleFilters,
) {
  return useQuery({
    queryKey: [...controlKeys.tuples(projectId, environmentId), filters],
    enabled: Boolean(environmentId),
    placeholderData: keepPreviousData,
    queryFn: () =>
      controlFetch<{ tuples: Tuple[]; continuationToken?: string }>(
        `/projects/${projectId}/environments/${environmentId}/tuples${buildQueryString(filters)}`,
      ),
  });
}

function buildQueryString(filters: TupleFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function useWriteTuple(projectId: string, environmentId: string | undefined, method: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tuple: Tuple) =>
      controlFetch(`/projects/${projectId}/environments/${environmentId}/tuples`, {
        method,
        body: JSON.stringify(tuple),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: controlKeys.tuples(projectId, environmentId) }),
  });
}

export function useAddTuple(projectId: string, environmentId: string | undefined) {
  return useWriteTuple(projectId, environmentId, 'POST');
}

export function useDeleteTuple(projectId: string, environmentId: string | undefined) {
  return useWriteTuple(projectId, environmentId, 'DELETE');
}
