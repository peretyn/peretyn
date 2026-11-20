import { randomUUID } from 'node:crypto';
import { E2E_INTERNAL_SECRET } from './runtime-process.js';

export interface EnvironmentSpec {
  internalUrl: string;
  model: unknown;
  environmentName: string;
}

export interface ProvisionedEnvironment {
  storeId: string;
  token: string;
}

export interface ModelSpec {
  internalUrl: string;
  storeId: string;
  model: unknown;
}

export async function provisionEnvironment(spec: EnvironmentSpec): Promise<string> {
  const { internalUrl, model } = spec;
  const { storeId, token } = await provisionEmptyEnvironment(spec);
  await writeModel({ internalUrl, storeId, model });
  return token;
}

export async function provisionEnvironmentWithoutSchema(
  spec: Omit<EnvironmentSpec, 'model'>,
): Promise<string> {
  const { token } = await provisionEmptyEnvironment(spec);
  return token;
}

export async function provisionEmptyEnvironment(
  spec: Omit<EnvironmentSpec, 'model'>,
): Promise<ProvisionedEnvironment> {
  const { internalUrl, environmentName } = spec;
  const storeId = await createStore(internalUrl, `e2e-${environmentName}`);
  const token = await createKey(internalUrl, { storeId, environmentName });
  return { storeId, token };
}

export async function writeModel({ internalUrl, storeId, model }: ModelSpec): Promise<void> {
  await internalPost(internalUrl, {
    path: `/v1/stores/${storeId}/authorization-models`,
    body: model,
  });
}

async function createStore(internalUrl: string, name: string): Promise<string> {
  const store = (await internalPost(internalUrl, { path: '/v1/stores', body: { name } })) as {
    id: string;
  };
  return store.id;
}

async function createKey(
  internalUrl: string,
  { storeId, environmentName }: { storeId: string; environmentName: string },
): Promise<string> {
  const key = (await internalPost(internalUrl, {
    path: '/v1/internal/keys',
    body: { environmentUuid: randomUUID(), storeId, projectSlug: 'peretyn-e2e', environmentName },
  })) as { plaintext: string };
  return key.plaintext;
}

async function internalPost(
  internalUrl: string,
  request: { path: string; body: unknown },
): Promise<unknown> {
  const response = await fetch(`${internalUrl}${request.path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Peretyn-Internal-Secret': E2E_INTERNAL_SECRET,
    },
    body: JSON.stringify(request.body),
  });
  if (!response.ok) {
    throw new Error(
      `Internal API ${request.path} returned ${response.status}: ${await response.text()}`,
    );
  }
  return response.json();
}
