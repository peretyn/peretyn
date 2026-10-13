export type Project = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  createdAt: string;
};

export type Environment = {
  id: string;
  name: string;
  projectId: string;
  openfgaStoreId?: string;
  externalUuid: string;
  status: string;
  isProduction: boolean;
  createdAt: string;
};

export type ApiTokenMeta = {
  id: string;
  environmentId: string;
  prefix: string;
  keyLast4: string;
  createdAt: string;
  rotatedAt: string | null;
};

export type PlaintextKey = { plaintext: string; prefix: string; last4: string };

export type CreatedEnvironment = Environment & { plaintext: string };

export type CreateProjectResult = { project: Project; environments: CreatedEnvironment[] };

type OpenFGAModel = {
  type_definitions?: Array<{ type: string; relations?: Record<string, unknown> }>;
};

export type SchemaVersion = {
  id: string;
  environmentId: string;
  label: string;
  dslSource: string;
  modelJson: OpenFGAModel;
  openfgaAuthorizationModelId: string | null;
  publishedAt: string;
  publishedBy: string | null;
};

export type Tuple = { user: string; relation: string; object: string; timestamp?: string };

export type EnvName = 'production' | 'development';
