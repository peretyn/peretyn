import type { PeretynSchema, TypeNames, CheckRelationsOf, DirectRelationsOf } from './schema.js';

/**
 * OpenFGA read consistency. `HIGHER_CONSISTENCY` skips the engine's caches so
 * a read reflects writes made just before it, at the cost of latency.
 */
export type Consistency = 'MINIMIZE_LATENCY' | 'HIGHER_CONSISTENCY';

/** A subject: `type:id`, or the userset `type:id#relation` when `relation` is set. */
export interface PrincipalRef {
  type: string;
  id: string;
  relation?: string;
}

/** An object: `type:id`. */
export interface ObjectRef {
  type: string;
  id: string;
}

/** A relationship tuple without schema typing: `subject` has `relation` on `object`. */
export interface TupleKey {
  subject: PrincipalRef;
  relation: string;
  object: ObjectRef;
}

/** How `write` treats tuples that already exist or are already gone. */
export interface WriteIdempotency {
  /** Writing a tuple that already exists: `'ignore'` (default) or `'error'`. */
  onDuplicate?: 'ignore' | 'error';
  /** Deleting a tuple that does not exist: `'ignore'` (default) or `'error'`. */
  onMissing?: 'ignore' | 'error';
  /**
   * Shorthand for `{ onDuplicate: 'error', onMissing: 'error' }`. Only fully
   * idempotent writes are retried, so a strict write is attempted once.
   */
  strict?: boolean;
}

/** Result of `check`. */
export interface CheckResponse {
  allowed: boolean;
  /** OpenFGA debug metadata; not part of the decision. */
  resolution?: string;
}

/** Result of `write`. */
export interface WriteResponse {
  /**
   * Number of tuples submitted for writing. With `onDuplicate: 'ignore'`
   * OpenFGA does not report how many were new, so this is not a net-new count.
   */
  written: number;
  /** Number of tuples submitted for deletion (see `written`). */
  deleted: number;
}

/**
 * A node in an OpenFGA expand tree: unions, intersections and differences
 * that end in leaves (direct users, a computed userset or a tuple-to-userset).
 */
export interface ExpandTreeNode {
  /** The userset this node resolves, e.g. `document:doc_99#viewer`. */
  name?: string;
  union?: { nodes?: ExpandTreeNode[] };
  intersection?: { nodes?: ExpandTreeNode[] };
  difference?: { base?: ExpandTreeNode; subtract?: ExpandTreeNode };
  leaf?: {
    users?: { users?: string[] };
    computed?: { userset?: string };
    tupleToUserset?: { tupleset?: string; computed?: Array<{ userset?: string }> };
  };
}

/** Result of `expand`. */
export interface ExpandResponse {
  /** Root of the tree; `undefined` when the relation resolves to nothing. */
  tree?: ExpandTreeNode;
}

/** Result of `lookupResources`. */
export interface LookupResourcesResponse {
  /** Ids of the matching objects, without the `type:` prefix. */
  ids: string[];
}

/** Result of one check in a `batchCheck`, in input order. */
export interface BatchCheckResult<C = BatchCheckItemFor<PeretynSchema, TypeNames<PeretynSchema>>> {
  /** The input this result answers, as passed in. */
  check: C;
  allowed: boolean;
  /** Set when the engine could not evaluate this check; `allowed` is then false. */
  error?: string;
}

/** Result of `lookupSubjects`. */
export interface LookupSubjectsResponse {
  /** Fully-qualified subjects: `type:id`, `type:id#relation`, or `type:*` for a wildcard. */
  subjects: string[];
}

/** One entry of `readChanges`, in the runtime's snake_case wire format. */
export interface TupleChange {
  tuple_key?: {
    user?: string;
    relation?: string;
    object?: string;
  };
  operation?: 'TUPLE_OPERATION_WRITE' | 'TUPLE_OPERATION_DELETE';
  /** RFC 3339 time of the change. */
  timestamp?: string;
}

/** A page of `readChanges`. */
export interface ReadChangesResponse {
  changes: TupleChange[];
  /** Pass to the next `readChanges` call to continue from this page. */
  continuationToken?: string;
}

/** Result of `me`: the scope the token unlocks. */
export interface MeResponse {
  storeId: string;
  environment: string;
  projectSlug: string;
  /** Token kind; `'env'` for environment API keys. */
  kind: string;
}

/** A subject of schema type `U`; `relation` must be a direct relation of `U`. */
export type SubjectArg<S extends PeretynSchema, U extends TypeNames<S>> = {
  type: U;
  id: string;
  relation?: DirectRelationsOf<S, U>;
};

/** A writable tuple on object type `T`; `relation` must be a direct relation of `T`. */
export type WriteTupleFor<S extends PeretynSchema, T extends TypeNames<S>> = {
  subject: { [U in TypeNames<S>]: SubjectArg<S, U> }[TypeNames<S>];
  relation: DirectRelationsOf<S, T>;
  object: { type: T; id: string };
};

/**
 * A writable tuple on any type of the schema. Use it to type tuple arrays
 * built ahead of a call; inline arrays get per-element errors from `write`.
 */
export type WriteTuple<S extends PeretynSchema> = {
  [T in TypeNames<S>]: WriteTupleFor<S, T>;
}[TypeNames<S>];

/**
 * Argument of `write`: at least one of `writes` / `deletes`. Each element's
 * `relation` is checked against its own `object.type`.
 */
export type WriteArgs<
  S extends PeretynSchema,
  TW extends readonly TypeNames<S>[],
  TD extends readonly TypeNames<S>[],
> = WriteIdempotency & { authorizationModelId?: string } & (
    | {
        writes: { [K in keyof TW]: WriteTupleFor<S, TW[K]> };
        deletes?: { [K in keyof TD]: WriteTupleFor<S, TD[K]> };
      }
    | {
        writes?: { [K in keyof TW]: WriteTupleFor<S, TW[K]> };
        deletes: { [K in keyof TD]: WriteTupleFor<S, TD[K]> };
      }
  );

/** Argument of `readChanges`. */
export interface ReadChangesArgs<S extends PeretynSchema = PeretynSchema> {
  /** Only return changes to objects of this type. */
  type?: TypeNames<S>;
  /** `continuationToken` from the previous page. */
  continuationToken?: string;
}

/** One item of `batchCheck`; `relation` is checked against its own `object.type`. */
export type BatchCheckItemFor<S extends PeretynSchema, T extends TypeNames<S>> = {
  subject: { [U in TypeNames<S>]: SubjectArg<S, U> }[TypeNames<S>];
  relation: CheckRelationsOf<S, T>;
  object: { type: T; id: string };
  contextualTuples?: WriteTuple<S>[];
  consistency?: Consistency;
};

/** `batchCheck` items, each typed against its own `object.type`. */
export type BatchCheckItemsFor<S extends PeretynSchema, T extends readonly TypeNames<S>[]> = {
  [K in keyof T]: BatchCheckItemFor<S, T[K]>;
};

/** Options for `peretyn()`. */
export interface PeretynClientOptions {
  /**
   * Environment API key (`prn_live_…` or `prn_test_…`). The runtime resolves
   * the environment's store from it, so no store id is needed.
   */
  token: string;
  /**
   * Runtime base URL (http or https). Default: `$PERETYN_RUNTIME_URL`, else
   * `http://localhost:8080`. An invalid URL throws here, not on first call.
   */
  baseUrl?: string;
  /** `fetch` implementation to use, e.g. for tests. Default: the global `fetch`. */
  fetch?: typeof fetch;
  /**
   * Budget for one call in ms, covering every attempt and reading the
   * response. A call settles within it, throwing `PeretynTimeoutError` when it runs out.
   * Default 1000; 0 disables it.
   */
  timeoutMs?: number;
  /**
   * Max retries on network errors, 429 and 5xx other than 504. Writes are
   * retried only when idempotent (see `WriteIdempotency`). Default 2; 0 disables.
   */
  retries?: number;
  /**
   * Base delay between retries in ms, doubled per attempt with jitter. A
   * `Retry-After` header takes precedence. Default 50.
   */
  retryBackoffMs?: number;
}

/**
 * Thrown when the runtime cannot be reached or does not answer within
 * `timeoutMs`. Catch it to decide whether an unavailable authorization service
 * fails open or closed; the SDK does not choose for you.
 */
export class PeretynUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PeretynUnavailableError';
  }
}

/** Thrown when a call exhausts `timeoutMs`. */
export class PeretynTimeoutError extends PeretynUnavailableError {
  /** The budget that was exhausted. */
  readonly timeoutMs: number;
  /** Attempts made within the budget. */
  readonly attempts: number;
  constructor(timeoutMs: number, attempts: number) {
    super(`peretyn: request did not complete within ${timeoutMs}ms (${attempts} attempts)`);
    this.name = 'PeretynTimeoutError';
    this.timeoutMs = timeoutMs;
    this.attempts = attempts;
  }
}

/**
 * Thrown when the runtime answers with an error status, and by `assert` on a
 * deny (status 403).
 */
export class PeretynError extends Error {
  /** HTTP status. */
  readonly status: number;
  /** Parsed JSON response body, or the raw text when it is not JSON. */
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'PeretynError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Client for the Peretyn runtime, created by `peretyn()`. With a schema type
 * argument, `type` and `relation` fields only accept values the schema declares.
 */
export interface PeretynClient<S extends PeretynSchema = PeretynSchema> {
  /** Returns the scope (store, environment, project) the token unlocks. */
  me(): Promise<MeResponse>;

  /**
   * Whether `subject` has `relation` (a direct relation or a permission) on
   * `object`. `contextualTuples` are considered for this call only.
   */
  check<T extends TypeNames<S>, U extends TypeNames<S>>(req: {
    subject: SubjectArg<S, U>;
    relation: CheckRelationsOf<S, T>;
    object: { type: T; id: string };
    contextualTuples?: WriteTuple<S>[];
    consistency?: Consistency;
    authorizationModelId?: string;
  }): Promise<CheckResponse>;

  /** Like `check`, but throws `PeretynError` with status 403 on a deny. */
  assert<T extends TypeNames<S>, U extends TypeNames<S>>(req: {
    subject: SubjectArg<S, U>;
    relation: CheckRelationsOf<S, T>;
    object: { type: T; id: string };
    contextualTuples?: WriteTuple<S>[];
    consistency?: Consistency;
    authorizationModelId?: string;
  }): Promise<void>;

  /**
   * Runs many checks and returns results in input order, each carrying the
   * check it answers. Sent in batches of 50 (OpenFGA's limit per request), at
   * most 4 at a time, all within one `timeoutMs`. The first failed batch
   * rejects the call and cancels the rest.
   */
  batchCheck<const T extends readonly TypeNames<S>[]>(
    checks: BatchCheckItemsFor<S, T>,
    opts?: { authorizationModelId?: string },
  ): Promise<BatchCheckResult<BatchCheckItemsFor<S, T>[number]>[]>;

  /**
   * Writes and deletes tuples in one transaction. Only direct relations are
   * writable. Existing writes and missing deletes are ignored unless
   * `WriteIdempotency` says otherwise.
   */
  write<const TW extends readonly TypeNames<S>[], const TD extends readonly TypeNames<S>[]>(
    req: WriteArgs<S, TW, TD>,
  ): Promise<WriteResponse>;

  /** Returns the tree of usersets that grant `relation` on `object`, to explain a decision. */
  expand<T extends TypeNames<S>>(req: {
    relation: CheckRelationsOf<S, T>;
    object: { type: T; id: string };
    contextualTuples?: WriteTuple<S>[];
    authorizationModelId?: string;
  }): Promise<ExpandResponse>;

  /** Ids of the `resourceType` objects on which `subject` has `relation`. */
  lookupResources<T extends TypeNames<S>, U extends TypeNames<S>>(req: {
    subject: SubjectArg<S, U>;
    relation: CheckRelationsOf<S, T>;
    resourceType: T;
    contextualTuples?: WriteTuple<S>[];
    consistency?: Consistency;
    authorizationModelId?: string;
  }): Promise<LookupResourcesResponse>;

  /** Subjects of `subjectType` that have `relation` on `resource`. */
  lookupSubjects<T extends TypeNames<S>, U extends TypeNames<S>>(req: {
    resource: { type: T; id: string };
    relation: CheckRelationsOf<S, T>;
    subjectType: U;
    contextualTuples?: WriteTuple<S>[];
    consistency?: Consistency;
    authorizationModelId?: string;
  }): Promise<LookupSubjectsResponse>;

  /** Pages through the tuple changelog, oldest first. */
  readChanges(req?: ReadChangesArgs<S>): Promise<ReadChangesResponse>;

  /** Returns a client with the same options and a different token. */
  withToken(token: string): PeretynClient<S>;
}

interface RawCheck {
  subject: PrincipalRef;
  relation: string;
  object: ObjectRef;
  contextualTuples?: TupleKey[];
  consistency?: Consistency;
  authorizationModelId?: string;
}
interface RawWrite extends WriteIdempotency {
  writes?: TupleKey[];
  deletes?: TupleKey[];
  authorizationModelId?: string;
}
interface RawExpand {
  relation: string;
  object: ObjectRef;
  contextualTuples?: TupleKey[];
  authorizationModelId?: string;
}
interface RawLookupResources {
  subject: PrincipalRef;
  relation: string;
  resourceType: string;
  contextualTuples?: TupleKey[];
  consistency?: Consistency;
  authorizationModelId?: string;
}
interface RawLookupSubjects {
  resource: ObjectRef;
  relation: string;
  subjectType: string;
  contextualTuples?: TupleKey[];
  consistency?: Consistency;
  authorizationModelId?: string;
}
interface RawReadChanges {
  type?: string;
  continuationToken?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:8080';
const DEFAULT_TIMEOUT_MS = 1_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BACKOFF_MS = 50;
const MAX_CHECKS_PER_BATCH = 50;
const MAX_BATCHES_IN_FLIGHT = 4;
const MILLISECONDS_PER_SECOND = 1000;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_GATEWAY_TIMEOUT = 504;
const MIN_JITTER_FACTOR = 0.5;
const JITTER_FACTOR_RANGE = 0.5;

interface TransportConfig {
  baseUrl: string;
  token: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxRetries: number;
  backoffMs: number;
}

interface CallScope {
  deadlineAt: number;
  signal?: AbortSignal;
}

interface RequestOptions {
  idempotent?: boolean;
  scope?: CallScope;
}

interface Transport {
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  startCall(signal?: AbortSignal): CallScope;
}

interface AttemptContext {
  config: TransportConfig;
  remaining: () => number;
  attempt: number;
  retries: number;
  signal?: AbortSignal;
}

type AttemptOutcome<T> = { isDone: true; value: T } | { isDone: false; waitMs: number };

/**
 * Creates a runtime client. Pass the schema type (`peretyn<typeof schema>(…)`)
 * to type-check every `type` and `relation` against it. Throws if `token` is
 * empty or `baseUrl` is not an http(s) URL.
 *
 * Calls reject with `PeretynError` when the runtime answers with an error
 * status, and with `PeretynUnavailableError` when it cannot be reached or
 * `timeoutMs` runs out (`PeretynTimeoutError`).
 */
export function peretyn<S extends PeretynSchema = PeretynSchema>(
  opts: PeretynClientOptions,
): PeretynClient<S> {
  const baseUrl = resolveBaseUrl(opts);
  assertValidToken(opts.token);
  const transport = createTransport({
    baseUrl,
    token: opts.token,
    fetchImpl: opts.fetch ?? fetch,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: opts.retries ?? DEFAULT_MAX_RETRIES,
    backoffMs: opts.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
  });
  const client = {
    ...createOperations(transport),
    withToken: (token: string): PeretynClient<S> => peretyn<S>({ ...opts, token }),
  };
  return client as unknown as PeretynClient<S>;
}

function resolveBaseUrl(opts: PeretynClientOptions): string {
  const envUrl = typeof process !== 'undefined' ? process.env?.PERETYN_RUNTIME_URL : undefined;
  const baseUrl = (opts.baseUrl ?? envUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (!/^https?:$/.test(URL.parse(baseUrl)?.protocol ?? '')) {
    throw new Error(`peretyn(): baseUrl must be an http(s) URL (got ${JSON.stringify(baseUrl)}).`);
  }
  return baseUrl;
}

function assertValidToken(token: string): void {
  if (!token) {
    throw new Error('peretyn(): a token is required (got empty string).');
  }
  try {
    new Headers({ Authorization: `Bearer ${token}` });
  } catch {
    throw new Error('peretyn(): the token contains characters an HTTP header cannot carry.');
  }
}

async function sendWithRetries<T>(
  config: TransportConfig,
  request: { url: string; init: RequestInit },
  policy: { retries: number; scope: CallScope },
): Promise<T> {
  const { retries, scope } = policy;
  const remaining = () => scope.deadlineAt - performance.now();

  for (let attempt = 0; ; attempt++) {
    scope.signal?.throwIfAborted();
    if (remaining() <= 0) throw new PeretynTimeoutError(config.timeoutMs, attempt);
    const context = { config, remaining, attempt, retries, signal: scope.signal };
    const outcome = await attemptRequest<T>(request.url, request.init, context);
    if (outcome.isDone) return outcome.value;
    await delay(outcome.waitMs);
  }
}

function startCall(config: TransportConfig, signal?: AbortSignal): CallScope {
  const deadlineAt = config.timeoutMs > 0 ? performance.now() + config.timeoutMs : Infinity;
  return { deadlineAt, signal };
}

function sendRequest<T>(
  config: TransportConfig,
  request: { path: string; init: RequestInit },
  options: RequestOptions = {},
): Promise<T> {
  const retries = options.idempotent === false ? 0 : config.maxRetries;
  const scope = options.scope ?? startCall(config);
  const url = `${config.baseUrl}/v1${request.path}`;
  return sendWithRetries<T>(config, { url, init: request.init }, { retries, scope });
}

function createTransport(config: TransportConfig): Transport {
  const authorization = { Authorization: `Bearer ${config.token}` };

  return {
    startCall: (signal?: AbortSignal) => startCall(config, signal),

    post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
      const headers = { 'Content-Type': 'application/json', ...authorization };
      const init = { method: 'POST', headers, body: JSON.stringify(body) };
      return sendRequest<T>(config, { path, init }, options);
    },

    get<T>(path: string, params?: Record<string, string>): Promise<T> {
      const hasParams = params && Object.keys(params).length > 0;
      const query = hasParams ? `?${new URLSearchParams(params).toString()}` : '';
      return sendRequest<T>(config, { path: `${path}${query}`, init: { headers: authorization } });
    },
  };
}

async function attemptRequest<T>(
  url: string,
  init: RequestInit,
  context: AttemptContext,
): Promise<AttemptOutcome<T>> {
  const controller = context.config.timeoutMs > 0 ? new AbortController() : undefined;
  const timer = controller && setTimeout(() => controller.abort(), context.remaining());
  const signal = combineSignals(controller?.signal, context.signal);
  try {
    return await fetchAndParse<T>(url, { ...init, signal }, context);
  } catch (err) {
    return planRetryAfterFailure(err, controller, context);
  } finally {
    clearTimeout(timer);
  }
}

function combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const present = signals.filter((signal) => signal !== undefined);
  return present.length > 1 ? AbortSignal.any(present) : present[0];
}

async function fetchAndParse<T>(
  url: string,
  init: RequestInit,
  context: AttemptContext,
): Promise<AttemptOutcome<T>> {
  const res = await context.config.fetchImpl(url, init);
  const waitMs = planRetryAfterResponse(res, context);
  if (waitMs === undefined) return { isDone: true, value: await parse<T>(res) };
  await res.body?.cancel();
  return { isDone: false, waitMs };
}

function planRetryAfterResponse(res: Response, context: AttemptContext): number | undefined {
  const { config, attempt, retries } = context;
  if (!retryable(res.status) || attempt >= retries) return undefined;
  const waitMs = retryAfterMs(res) ?? jitter(config.backoffMs * 2 ** attempt);
  return waitMs < context.remaining() ? waitMs : undefined;
}

function planRetryAfterFailure<T>(
  err: unknown,
  controller: AbortController | undefined,
  context: AttemptContext,
): AttemptOutcome<T> {
  const { config, attempt, retries } = context;
  context.signal?.throwIfAborted();
  if (err instanceof PeretynError) throw err;
  if (controller?.signal.aborted) throw new PeretynTimeoutError(config.timeoutMs, attempt + 1);
  const waitMs = jitter(config.backoffMs * 2 ** attempt);
  if (attempt < retries && waitMs < context.remaining()) return { isDone: false, waitMs };
  throw new PeretynUnavailableError(
    `peretyn: could not reach the runtime at ${config.baseUrl} (${attempt + 1} attempts)`,
    { cause: err },
  );
}

function createOperations(transport: Transport) {
  return {
    me: (): Promise<MeResponse> => transport.get<MeResponse>('/me'),
    check: (req: RawCheck) => checkTuple(transport, req),
    assert: (req: RawCheck) => assertAllowed(transport, req),
    batchCheck: (checks: RawCheck[], options?: { authorizationModelId?: string }) =>
      batchCheckTuples(transport, checks, options),
    write: (req: RawWrite) => writeTuples(transport, req),
    expand: (req: RawExpand) => expandRelation(transport, req),
    lookupResources: (req: RawLookupResources) => lookupResourceIds(transport, req),
    lookupSubjects: (req: RawLookupSubjects) => lookupSubjectStrings(transport, req),
    readChanges: (req: RawReadChanges = {}) => readTupleChanges(transport, req),
  };
}

function toCheckTupleKey(check: RawCheck) {
  return {
    user: principalToString(check.subject),
    relation: check.relation,
    object: objectToString(check.object),
  };
}

async function checkTuple(transport: Transport, req: RawCheck): Promise<CheckResponse> {
  const body = {
    tuple_key: toCheckTupleKey(req),
    contextual_tuples: contextualTuples(req.contextualTuples),
    consistency: req.consistency,
    authorization_model_id: req.authorizationModelId,
  };
  const raw = await transport.post<{ allowed?: boolean; resolution?: string }>('/check', body);
  return { allowed: Boolean(raw.allowed), resolution: raw.resolution };
}

async function assertAllowed(transport: Transport, req: RawCheck): Promise<void> {
  const { allowed } = await checkTuple(transport, req);
  if (allowed) return;
  throw new PeretynError(
    HTTP_FORBIDDEN,
    `denied: ${principalToString(req.subject)} #${req.relation} ${objectToString(req.object)}`,
    { allowed: false },
  );
}

type BatchCheckWireResult = Record<string, { allowed?: boolean; error?: { message?: string } }>;
type BatchCheckWireResponse = { result?: BatchCheckWireResult };

function toBatchCheckItem(check: RawCheck, index: number) {
  return {
    tuple_key: toCheckTupleKey(check),
    contextual_tuples: contextualTuples(check.contextualTuples),
    consistency: check.consistency,
    correlation_id: `c${index}`,
  };
}

function splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += chunkSize) {
    chunks.push(items.slice(start, start + chunkSize));
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  let hasFailed = false;
  const runWorker = async () => {
    while (!hasFailed && nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index] as T).catch((err: unknown) => {
        hasFailed = true;
        throw err;
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

type BatchCheckWireItem = ReturnType<typeof toBatchCheckItem>;

function batchCheckChunkSender(
  transport: Transport,
  call: { scope: CallScope; authorizationModelId?: string },
) {
  return (chunk: BatchCheckWireItem[]) =>
    transport.post<BatchCheckWireResponse>(
      '/batch-check',
      { checks: chunk, authorization_model_id: call.authorizationModelId },
      { scope: call.scope },
    );
}

async function batchCheckTuples(
  transport: Transport,
  checks: RawCheck[],
  options?: { authorizationModelId?: string },
): Promise<BatchCheckResult<RawCheck>[]> {
  const chunks = splitIntoChunks(checks.map(toBatchCheckItem), MAX_CHECKS_PER_BATCH);
  const controller = new AbortController();
  const scope = transport.startCall(controller.signal);
  const authorizationModelId = options?.authorizationModelId;
  const sendChunk = batchCheckChunkSender(transport, { scope, authorizationModelId });
  try {
    const responses = await mapWithConcurrency(chunks, MAX_BATCHES_IN_FLIGHT, sendChunk);
    return toBatchCheckResults(checks, responses);
  } catch (err) {
    controller.abort();
    throw err;
  }
}

function toBatchCheckResults(
  checks: RawCheck[],
  responses: BatchCheckWireResponse[],
): BatchCheckResult<RawCheck>[] {
  const result = Object.fromEntries(responses.flatMap((r) => Object.entries(r.result ?? {})));
  return checks.map((check, index) => {
    const entry = result[`c${index}`];
    return { check, allowed: Boolean(entry?.allowed), error: entry?.error?.message };
  });
}

function resolveWriteMode(mode: 'ignore' | 'error' | undefined, isStrict: boolean) {
  return isStrict ? 'error' : (mode ?? 'ignore');
}

function buildWriteBody(req: RawWrite, writeMode: string, deleteMode: string) {
  const writes = req.writes ?? [];
  const deletes = req.deletes ?? [];
  const body: Record<string, unknown> = {};
  if (writes.length > 0) {
    body.writes = { tuple_keys: writes.map(tupleKeyToOpenFGA), on_duplicate: writeMode };
  }
  if (deletes.length > 0) {
    body.deletes = { tuple_keys: deletes.map(tupleKeyToOpenFGA), on_missing: deleteMode };
  }
  if (req.authorizationModelId) {
    body.authorization_model_id = req.authorizationModelId;
  }
  return body;
}

async function writeTuples(transport: Transport, req: RawWrite): Promise<WriteResponse> {
  const writes = req.writes ?? [];
  const deletes = req.deletes ?? [];
  if (writes.length === 0 && deletes.length === 0) {
    throw new Error('write() called with no writes or deletes.');
  }
  const isStrict = req.strict === true;
  const onDuplicate = resolveWriteMode(req.onDuplicate, isStrict);
  const onMissing = resolveWriteMode(req.onMissing, isStrict);
  const isIdempotent =
    (writes.length === 0 || onDuplicate === 'ignore') &&
    (deletes.length === 0 || onMissing === 'ignore');
  await transport.post<unknown>('/write', buildWriteBody(req, onDuplicate, onMissing), {
    idempotent: isIdempotent,
  });
  return { written: writes.length, deleted: deletes.length };
}

async function expandRelation(transport: Transport, req: RawExpand): Promise<ExpandResponse> {
  const raw = await transport.post<{ tree?: { root?: ExpandTreeNode } }>('/expand', {
    tuple_key: {
      relation: req.relation,
      object: objectToString(req.object),
    },
    contextual_tuples: contextualTuples(req.contextualTuples),
    authorization_model_id: req.authorizationModelId,
  });
  return { tree: raw.tree?.root };
}

async function lookupResourceIds(
  transport: Transport,
  req: RawLookupResources,
): Promise<LookupResourcesResponse> {
  const raw = await transport.post<{ objects?: string[] }>('/list-objects', {
    type: req.resourceType,
    relation: req.relation,
    user: principalToString(req.subject),
    contextual_tuples: contextualTuples(req.contextualTuples),
    consistency: req.consistency,
    authorization_model_id: req.authorizationModelId,
  });
  const objects = raw.objects ?? [];
  const prefix = `${req.resourceType}:`;
  const ids = objects.map((o) => (o.startsWith(prefix) ? o.slice(prefix.length) : o));
  return { ids };
}

interface WireSubject {
  object?: { type?: string; id?: string };
  userset?: { type?: string; id?: string; relation?: string };
  wildcard?: { type?: string };
}

function wireSubjectToStrings(user: WireSubject): string[] {
  if (user.userset?.type) {
    const relation = user.userset.relation ? `#${user.userset.relation}` : '';
    return [`${user.userset.type}:${user.userset.id ?? ''}${relation}`];
  }
  if (user.object?.type) {
    return [`${user.object.type}:${user.object.id ?? ''}`];
  }
  if (user.wildcard?.type) {
    return [`${user.wildcard.type}:*`];
  }
  return [];
}

async function lookupSubjectStrings(
  transport: Transport,
  req: RawLookupSubjects,
): Promise<LookupSubjectsResponse> {
  const raw = await transport.post<{ users?: WireSubject[] }>('/list-users', {
    object: { type: req.resource.type, id: req.resource.id },
    relation: req.relation,
    user_filters: [{ type: req.subjectType }],
    contextual_tuples: contextualTuples(req.contextualTuples),
    consistency: req.consistency,
    authorization_model_id: req.authorizationModelId,
  });
  return { subjects: raw.users?.flatMap(wireSubjectToStrings) ?? [] };
}

async function readTupleChanges(
  transport: Transport,
  req: RawReadChanges,
): Promise<ReadChangesResponse> {
  const params: Record<string, string> = {};
  if (req.type) params.type = req.type;
  if (req.continuationToken) params.continuation_token = req.continuationToken;
  const raw = await transport.get<{ changes?: TupleChange[]; continuation_token?: string }>(
    '/changes',
    Object.keys(params).length > 0 ? params : undefined,
  );
  return { changes: raw.changes ?? [], continuationToken: raw.continuation_token };
}

function principalToString(p: PrincipalRef): string {
  return p.relation ? `${p.type}:${p.id}#${p.relation}` : `${p.type}:${p.id}`;
}

function objectToString(o: ObjectRef): string {
  return `${o.type}:${o.id}`;
}

function tupleKeyToOpenFGA(t: TupleKey) {
  return {
    user: principalToString(t.subject),
    relation: t.relation,
    object: objectToString(t.object),
  };
}

function contextualTuples(t: TupleKey[] | undefined) {
  if (!t || t.length === 0) return undefined;
  return { tuple_keys: t.map(tupleKeyToOpenFGA) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryable(status: number): boolean {
  return (
    status !== HTTP_GATEWAY_TIMEOUT &&
    (status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_INTERNAL_SERVER_ERROR)
  );
}

function jitter(ms: number): number {
  return ms * (MIN_JITTER_FACTOR + Math.random() * JITTER_FACTOR_RANGE);
}

function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * MILLISECONDS_PER_SECOND);
  const dateMs = Date.parse(header);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Peretyn runtime returned ${res.status}`;
    throw new PeretynError(res.status, message, body);
  }
  return body as T;
}
