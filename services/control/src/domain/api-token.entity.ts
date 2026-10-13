import type { apiTokenMetadata } from '../db/schema.js';

export type ApiToken = typeof apiTokenMetadata.$inferSelect;
