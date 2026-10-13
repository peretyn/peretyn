import { useMutation } from '@tanstack/react-query';
import type { ExpandTreeNode } from '@peretyn/sdk';
import { controlFetch } from './client';
import type { Tuple } from './types';

export function useCheck(projectId: string, environmentId: string | undefined) {
  return useMutation({
    mutationFn: (tuple: Tuple) =>
      controlFetch<{ allowed: boolean }>(
        `/projects/${projectId}/environments/${environmentId}/check`,
        { method: 'POST', body: JSON.stringify(tuple) },
      ),
  });
}

export function useExpand(projectId: string, environmentId: string | undefined) {
  return useMutation({
    mutationFn: (input: { relation: string; object: string }) =>
      controlFetch<{ tree: ExpandTreeNode | null }>(
        `/projects/${projectId}/environments/${environmentId}/expand`,
        { method: 'POST', body: JSON.stringify(input) },
      ),
  });
}
