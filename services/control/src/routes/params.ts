import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const projectParam = zValidator('param', z.object({ projectId: z.uuid() }));
export const environmentParam = zValidator(
  'param',
  z.object({ projectId: z.uuid(), envId: z.uuid() }),
);
