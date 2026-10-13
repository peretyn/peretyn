export class RuntimeResponseError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'RuntimeResponseError';
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_RUNTIME_URL = 'http://localhost:8081';

type TupleKey = { user: string; relation: string; object: string };

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  bearer?: string;
}

interface FailedRequest {
  method: string;
  path: string;
  status: number;
}

type Call = <T>(options: RequestOptions) => Promise<T>;

type KeyCredentials = { plaintext: string; prefix: string; last4: string };

type KeyCreationParams = {
  environmentUuid: string;
  storeId: string;
  projectSlug: string;
  environmentName: string;
};

type ResolvedKey = { storeId: string; environment: string; projectSlug: string; kind: string };

type ReadTuplesBody = {
  tuple_key?: Partial<TupleKey>;
  page_size?: number;
  continuation_token?: string;
};

type ReadTuplesResult = {
  tuples?: Array<{ key?: Partial<TupleKey>; timestamp?: string }>;
  continuation_token?: string;
};

type CheckTupleResult = { allowed?: boolean; resolution?: string };

type ExpandTupleResult = { tree?: { root?: unknown } };

type WriteTuplesBody = {
  writes?: { tuple_keys: TupleKey[] };
  deletes?: { tuple_keys: TupleKey[] };
};

function errorDetail(parsed: unknown, { method, path, status }: FailedRequest): string {
  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof (parsed as { error?: unknown }).error === 'string'
  ) {
    return (parsed as { error: string }).error;
  }
  if (typeof parsed === 'string' && parsed.length > 0) return parsed;
  return `runtime ${method} ${path} failed (${status})`;
}

function parseResponseText(text: string): unknown {
  try {
    return text.length > 0 ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function readBaseUrl(): string {
  return (process.env.PERETYN_RUNTIME_INTERNAL_URL ?? DEFAULT_RUNTIME_URL).replace(/\/+$/, '');
}

function readInternalSecret(): string {
  const secret = process.env.PERETYN_INTERNAL_SECRET;
  if (!secret) {
    throw new Error('runtimeClient: PERETYN_INTERNAL_SECRET is required.');
  }
  return secret;
}

function buildHeaders(secret: string, bearer?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(bearer ? { Authorization: `Bearer ${bearer}` } : { 'X-Peretyn-Internal-Secret': secret }),
  };
}

function createCall(baseUrl: string, secret: string): Call {
  return async function call<T>({ method = 'POST', path, body, bearer }: RequestOptions) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: buildHeaders(secret, bearer),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const parsed = parseResponseText(await res.text());
    if (!res.ok) {
      throw new RuntimeResponseError(
        res.status,
        errorDetail(parsed, { method, path, status: res.status }),
      );
    }
    return parsed as T;
  };
}

async function writeAuthorizationModel(call: Call, storeId: string, model: unknown) {
  const { authorization_model_id: id } = await call<{ authorization_model_id?: string }>({
    path: `/v1/stores/${storeId}/authorization-models`,
    body: model,
  });
  if (!id) throw new Error('runtime did not return an authorization_model_id');
  return { authorizationModelId: id };
}

function storeOperations(call: Call) {
  return {
    createStore(name: string) {
      return call<{ id: string; name: string; created_at: string }>({
        path: '/v1/stores',
        body: { name },
      });
    },
    deleteStore(storeId: string) {
      return call<null>({ method: 'DELETE', path: `/v1/stores/${storeId}` });
    },
    writeAuthorizationModel(storeId: string, model: unknown) {
      return writeAuthorizationModel(call, storeId, model);
    },
  };
}

function keyOperations(call: Call) {
  return {
    createKey(params: KeyCreationParams) {
      return call<KeyCredentials>({ path: '/v1/internal/keys', body: params });
    },
    rotateKey(environmentUuid: string) {
      return call<KeyCredentials>({ path: `/v1/internal/keys/${environmentUuid}/rotate` });
    },
    deleteKey(environmentUuid: string) {
      return call<null>({ method: 'DELETE', path: `/v1/internal/keys/${environmentUuid}` });
    },
    resolveKey(key: string) {
      return call<ResolvedKey>({ method: 'GET', path: '/v1/me', bearer: key });
    },
  };
}

function tupleOperations(call: Call) {
  return {
    checkTuple(storeId: string, body: { tuple_key: TupleKey }) {
      return call<CheckTupleResult>({ path: `/v1/internal/stores/${storeId}/check`, body });
    },
    readTuples(storeId: string, body: ReadTuplesBody) {
      return call<ReadTuplesResult>({ path: `/v1/internal/stores/${storeId}/read`, body });
    },
    writeTuples(storeId: string, body: WriteTuplesBody) {
      return call<unknown>({ path: `/v1/internal/stores/${storeId}/write`, body });
    },
    expandTuple(storeId: string, body: { tuple_key: Omit<TupleKey, 'user'> }) {
      return call<ExpandTupleResult>({ path: `/v1/internal/stores/${storeId}/expand`, body });
    },
  };
}

export function runtimeClient() {
  const call = createCall(readBaseUrl(), readInternalSecret());
  return { ...storeOperations(call), ...keyOperations(call), ...tupleOperations(call) };
}

export type RuntimeClient = ReturnType<typeof runtimeClient>;
