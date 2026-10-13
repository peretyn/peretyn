export const controlKeys = {
  projects: (organizationId: string | undefined) => ['projects', organizationId] as const,
  project: (projectId: string) => ['project', projectId] as const,
  environments: (projectId: string) => ['environments', projectId] as const,
  key: (projectId: string, environmentId: string | undefined) =>
    ['env-key', projectId, environmentId] as const,
  schemas: (projectId: string, environmentId: string | undefined) =>
    ['schemas', projectId, environmentId] as const,
  tuples: (projectId: string, environmentId: string | undefined) =>
    ['tuples', projectId, environmentId] as const,
};
