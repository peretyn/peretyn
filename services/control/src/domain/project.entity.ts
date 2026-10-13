import type { project } from '../db/schema.js';

export type Project = typeof project.$inferSelect;
