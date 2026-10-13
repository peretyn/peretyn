const ORIGIN = 'http://same-origin.invalid';

export function sameOriginPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/')) return undefined;
  return new URL(value, ORIGIN).origin === ORIGIN ? value : undefined;
}
