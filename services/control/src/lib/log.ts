type Fields = Record<string, unknown>;

function describe(error: Error): string {
  return error.cause instanceof Error
    ? `${error.message}: ${describe(error.cause)}`
    : error.message;
}

function line(msg: string, fields: Fields): string {
  return JSON.stringify({ component: 'control', msg, ...fields }, (_, value) =>
    value instanceof Error ? describe(value) : value,
  );
}

export function log(msg: string, fields: Fields = {}): void {
  console.log(line(msg, fields));
}

export function logError(msg: string, fields: Fields = {}): void {
  console.error(line(msg, fields));
}
