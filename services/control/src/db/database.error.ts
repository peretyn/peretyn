import { ErrorFactory } from '@praha/error-factory';
import { PeretynControlSchema } from './index.js';

export class DatabaseError extends ErrorFactory({
  name: 'DatabaseError',
  message: ({ entity, operation }) => `Unable to ${operation} from database (entity: ${entity})`,
  fields: ErrorFactory.fields<{
    entity: keyof PeretynControlSchema;
    operation: 'read' | 'write';
    error?: Error;
  }>(),
}) {}

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  const hasCode = (e: unknown) =>
    typeof e === 'object' && e != null && (e as { code?: unknown }).code === UNIQUE_VIOLATION;
  return hasCode(error) || hasCode((error as { cause?: unknown })?.cause);
}
