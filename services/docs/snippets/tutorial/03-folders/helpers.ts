import { peretyn } from '@peretyn/sdk';
import type { schema } from './schema.ts';

export const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

export const user = (id: string) => ({ type: 'user', id }) as const;
export const document = (id: string) => ({ type: 'document', id }) as const;
export const team = (id: string) => ({ type: 'team', id }) as const;
export const membersOf = (id: string) => ({ type: 'team', id, relation: 'member' }) as const;
export const folder = (id: string) => ({ type: 'folder', id }) as const;

interface Verdict {
  check: { subject: { id: string }; relation: string; object: { type: string; id: string } };
  allowed: boolean;
}

export function printVerdicts(verdicts: Verdict[]): void {
  for (const { check, allowed } of verdicts) {
    const verdict = allowed ? 'allowed' : 'denied';
    console.log(
      `${check.subject.id} ${check.relation} ${check.object.type}:${check.object.id}: ${verdict}`,
    );
  }
}
