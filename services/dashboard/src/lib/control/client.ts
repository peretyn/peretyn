import { StatusCodes } from 'http-status-codes';

const BASE = '/manage/v1';

export class ControlError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ControlError';
  }
}

export async function controlFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => null) : null;
    throw new ControlError(res.status, messageFrom(body, res.status));
  }
  if (res.status === StatusCodes.NO_CONTENT) return null as T;
  if (!isJson) throw new ControlError(res.status, `Unexpected response (${res.status})`);
  return (await res.json()) as T;
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return `Request failed (${status})`;
}
