import path from 'node:path';
import { createOpenAPI } from 'fumadocs-openapi/server';

const SPEC_PATH = path.join(process.cwd(), '../../api/peretyn.openapi.yaml');

export const openapi = createOpenAPI({ input: [SPEC_PATH] });
