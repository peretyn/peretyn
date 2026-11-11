import { peretyn, PeretynUnavailableError } from '@peretyn/sdk';
import type { schema } from './schema.ts';

const authz = peretyn<typeof schema>({ token: process.env.PERETYN_TOKEN! });

async function canView(userId: string, documentId: string): Promise<boolean> {
  try {
    const { allowed } = await authz.check({
      subject: { type: 'user', id: userId },
      relation: 'can_view',
      object: { type: 'document', id: documentId },
    });
    return allowed;
  } catch (error) {
    if (error instanceof PeretynUnavailableError) return false;
    throw error;
  }
}

console.log((await canView('alice', 'roadmap')) ? 'allowed' : 'denied');
