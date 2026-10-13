import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { controlFetch } from './client';
import { controlKeys } from './keys';
import type { CreateProjectResult, Project } from './types';

export function useProjects(organizationId: string | undefined) {
  return useQuery({
    queryKey: controlKeys.projects(organizationId),
    enabled: Boolean(organizationId),
    queryFn: () => controlFetch<Project[]>('/projects'),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: controlKeys.project(projectId),
    queryFn: () => controlFetch<{ project: Project }>(`/projects/${projectId}`),
    select: (data) => data.project,
  });
}

export function useCreateProject(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { slug: string; name: string }) =>
      controlFetch<CreateProjectResult>(`/projects`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: controlKeys.projects(organizationId) }),
  });
}

export function useDeleteProject(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      controlFetch<null>(`/projects/${projectId}`, { method: 'DELETE' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: controlKeys.projects(organizationId) }),
  });
}
