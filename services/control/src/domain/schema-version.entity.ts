import type { schemaVersion } from '../db/schema.js';

export type SchemaVersion = typeof schemaVersion.$inferSelect;
