import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useIsOrgOwner } from '../use-is-owner';
import { controlFetch } from './client';
import { controlKeys } from './keys';
import type { ApiTokenMeta, Environment, EnvName, PlaintextKey } from './types';

export function useEnvParam(): EnvName {
  return useSearchParams().get('env') === 'development' ? 'development' : 'production';
}

export function useEnvironments(projectId: string) {
  return useQuery({
    queryKey: controlKeys.environments(projectId),
    queryFn: () =>
      controlFetch<{ environments: Environment[] }>(`/projects/${projectId}/environments`),
    select: (data) => data.environments,
  });
}

export function useCurrentEnvironment(projectId: string) {
  const requested = useEnvParam();
  const owner = useIsOrgOwner();
  const environments = useEnvironments(projectId);

  const envName: EnvName = owner.isOwner ? requested : 'development';
  const environment =
    owner.isOwner === undefined
      ? undefined
      : environments.data?.find((e) =>
          envName === 'production' ? e.isProduction : !e.isProduction,
        );

  return {
    environment,
    isPending: environments.isPending || owner.isPending,
    error: environments.error ?? owner.error,
  };
}

export function useEnvironmentKey(projectId: string, environmentId: string | undefined) {
  return useQuery({
    queryKey: controlKeys.key(projectId, environmentId),
    enabled: Boolean(environmentId),
    queryFn: () =>
      controlFetch<ApiTokenMeta>(`/projects/${projectId}/environments/${environmentId}/key`),
  });
}

export function useRotateKey(projectId: string, environmentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      controlFetch<PlaintextKey>(
        `/projects/${projectId}/environments/${environmentId}/key/rotate`,
        { method: 'POST' },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: controlKeys.key(projectId, environmentId) }),
  });
}

export function maskKey(key: ApiTokenMeta) {
  return `${key.prefix}…${key.keyLast4}`;
}
