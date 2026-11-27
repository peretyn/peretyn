import { resolve } from 'node:path';
import { execa } from 'execa';
import { E2E_INTERNAL_SECRET, waitForReady, type ServiceProcess } from './runtime-process.js';

const CONTROL_DIR = resolve(import.meta.dirname, '../../../services/control');
const DASHBOARD_URL = 'http://localhost:3000';
const AUTH_SECRET = 'e2e-better-auth-secret-at-least-32-characters';
const ADMIN = { email: 'admin@example.com', password: 'e2e-admin-password', name: 'Admin' };

export interface ControlOptions {
  databaseUrl: string;
  runtimeInternalUrl: string;
  port: number;
}

function controlEnv(options: ControlOptions) {
  return {
    DATABASE_URL: options.databaseUrl,
    PERETYN_RUNTIME_INTERNAL_URL: options.runtimeInternalUrl,
    PERETYN_INTERNAL_SECRET: E2E_INTERNAL_SECRET,
    PERETYN_CONTROL_PORT: String(options.port),
    PERETYN_DASHBOARD_URL: DASHBOARD_URL,
    BETTER_AUTH_SECRET: AUTH_SECRET,
  };
}

export async function startControl(options: ControlOptions): Promise<ServiceProcess> {
  const env = controlEnv(options);
  await execa('node', ['dist/db/push.js'], { cwd: CONTROL_DIR, env });
  const control = {
    name: 'Control plane',
    url: `http://localhost:${options.port}`,
    process: execa('node', ['dist/server.js'], { cwd: CONTROL_DIR, env, reject: false }),
  };
  await waitForReady(control);
  await execa('node', ['dist/scripts/enroll.js', ADMIN.email, ADMIN.password, ADMIN.name], {
    cwd: CONTROL_DIR,
    env,
  });
  return control;
}

export async function stopControl(control: ServiceProcess | undefined): Promise<void> {
  control?.process.kill('SIGTERM');
  await control?.process;
}

async function controlPost(url: string, body: unknown, cookie = ''): Promise<Response> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: DASHBOARD_URL, Cookie: cookie },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}: ${await res.text()}`);
  return res;
}

async function signIn(controlUrl: string): Promise<string> {
  const res = await controlPost(`${controlUrl}/api/auth/sign-in/email`, {
    email: ADMIN.email,
    password: ADMIN.password,
  });
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

interface CreatedProject {
  environments: Array<{ name: string; plaintext: string }>;
}

export async function createDevelopmentKey(controlUrl: string, slug: string): Promise<string> {
  const cookie = await signIn(controlUrl);
  const org = await controlPost(
    `${controlUrl}/api/auth/organization/create`,
    { name: slug, slug },
    cookie,
  );
  const { id: organizationId } = (await org.json()) as { id: string };
  await controlPost(`${controlUrl}/api/auth/organization/set-active`, { organizationId }, cookie);
  const project = await controlPost(
    `${controlUrl}/manage/v1/projects`,
    { slug, name: slug },
    cookie,
  );
  const { environments } = (await project.json()) as CreatedProject;
  const development = environments.find((environment) => environment.name === 'development');
  if (!development) throw new Error('the new project has no development environment');
  return development.plaintext;
}
