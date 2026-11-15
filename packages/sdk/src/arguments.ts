const CHECK_FIELDS = ['subject', 'relation', 'object'] as const;
const WRITE_FIELDS = ['writes', 'deletes'] as const;
const TUPLES_EXAMPLE = '[{ subject, relation, object }]';

export function assertCheckArgument(operation: 'check' | 'assert', req: unknown): void {
  const missing = missingCheckField(req);
  if (missing === undefined) return;
  throw new TypeError(
    `peretyn: ${operation}() is missing "${missing}"; it needs subject, relation and object`,
  );
}

export function assertBatchCheckArgument(checks: unknown): void {
  if (!Array.isArray(checks)) {
    throw new TypeError(
      `peretyn: batchCheck() takes an array of checks, such as ${TUPLES_EXAMPLE}; got ${describeValue(checks)}`,
    );
  }
  checks.forEach((check: unknown, index) => {
    const missing = missingCheckField(check);
    if (missing === undefined) return;
    throw new TypeError(
      `peretyn: batchCheck() check ${index} is missing "${missing}"; each check needs subject, relation and object`,
    );
  });
}

export function assertWriteArgument(req: unknown): void {
  const fields = isRecord(req) ? req : {};
  const invalidField = WRITE_FIELDS.find(
    (field) => fields[field] !== undefined && !Array.isArray(fields[field]),
  );
  if (invalidField === undefined) return;
  throw new TypeError(
    `peretyn: write() "${invalidField}" must be an array of tuples, such as ${TUPLES_EXAMPLE}`,
  );
}

function missingCheckField(value: unknown): string | undefined {
  const fields = isRecord(value) ? value : {};
  return CHECK_FIELDS.find((field) => fields[field] == null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function describeValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}
