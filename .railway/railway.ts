import { readFileSync } from 'node:fs';
import { defineRailway, image, postgres, service } from 'railway/iac';

const RELEASED_MANIFEST = new URL('../services/runtime/package.json', import.meta.url);
const IMAGE_REPOSITORY = 'ghcr.io/peretyn/peretyn';
const GATEWAY_IMAGE = 'caddy:2-alpine';
const GATEWAY_CADDYFILE_SOURCE = new URL('../deploy/railway/Caddyfile', import.meta.url);
const GATEWAY_CADDYFILE_PATH = '/etc/caddy/Caddyfile';
const GATEWAY_START_COMMAND = `sh -c 'printenv CADDYFILE > ${GATEWAY_CADDYFILE_PATH} && exec caddy run --config ${GATEWAY_CADDYFILE_PATH} --adapter caddyfile'`;
const GATEWAY_PORT = 8080;
const RUNTIME_INTERNAL_PORT = 8081;
const CONTROL_PORT = 3001;
const DASHBOARD_PORT = 3000;
const PUBLIC_DOMAIN = 'app.peretyn.dev';
const REQUEST_TIMEOUT = '5s';
const EMAIL_SENDER = 'Peretyn <no-reply@mail.peretyn.dev>';

const RUNTIME_PRIVATE_DOMAIN = '${{runtime.RAILWAY_PRIVATE_DOMAIN}}';
const CONTROL_PRIVATE_DOMAIN = '${{control.RAILWAY_PRIVATE_DOMAIN}}';
const DASHBOARD_PRIVATE_DOMAIN = '${{dashboard.RAILWAY_PRIVATE_DOMAIN}}';

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set to pull the private GHCR images`);
  }
  return value;
}

function readReleasedVersion(): string {
  const manifest: { version?: unknown } = JSON.parse(readFileSync(RELEASED_MANIFEST, 'utf8'));
  if (typeof manifest.version !== 'string') {
    throw new Error(`${RELEASED_MANIFEST.pathname} has no version`);
  }
  return manifest.version;
}

function peretynImage(serviceName: string, version: string) {
  return image(`${IMAGE_REPOSITORY}/${serviceName}:${version}`);
}

export default defineRailway((ctx, project) => {
  const registryCredentials = {
    username: readRequiredEnv('GHCR_USERNAME'),
    password: readRequiredEnv('GHCR_TOKEN'),
  };

  const version = readReleasedVersion();
  const database = postgres('postgres');

  const runtime = service('runtime', {
    source: peretynImage('runtime', version),
    deploy: { registryCredentials },
    env: {
      PERETYN_RUNTIME_DATABASE_URL: database.env.DATABASE_URL,
      PERETYN_INTERNAL_SECRET: ctx.shared.PERETYN_INTERNAL_SECRET,
      PERETYN_REQUEST_TIMEOUT: REQUEST_TIMEOUT,
    },
  });

  const control = service('control', {
    source: peretynImage('control', version),
    deploy: { registryCredentials },
    env: {
      DATABASE_URL: database.env.DATABASE_URL,
      PERETYN_RUNTIME_INTERNAL_URL: `http://${RUNTIME_PRIVATE_DOMAIN}:${RUNTIME_INTERNAL_PORT}`,
      PERETYN_INTERNAL_SECRET: ctx.shared.PERETYN_INTERNAL_SECRET,
      BETTER_AUTH_SECRET: ctx.shared.BETTER_AUTH_SECRET,
      PERETYN_RESEND_API_KEY: ctx.shared.PERETYN_RESEND_API_KEY,
      PERETYN_EMAIL_FROM: EMAIL_SENDER,
      PERETYN_DASHBOARD_URL: `https://${PUBLIC_DOMAIN}`,
    },
  });

  const dashboard = service('dashboard', {
    source: peretynImage('dashboard', version),
    deploy: { registryCredentials },
    env: {
      HOSTNAME: '::',
      PORT: String(DASHBOARD_PORT),
      PERETYN_CONTROL_URL: `http://${CONTROL_PRIVATE_DOMAIN}:${CONTROL_PORT}`,
    },
  });

  const gateway = service('caddy', {
    source: image(GATEWAY_IMAGE),
    start: GATEWAY_START_COMMAND,
    domains: [{ domain: PUBLIC_DOMAIN, port: GATEWAY_PORT }],
    env: {
      CADDYFILE: readFileSync(GATEWAY_CADDYFILE_SOURCE, 'utf8'),
      PORT: String(GATEWAY_PORT),
      RUNTIME_HOST: RUNTIME_PRIVATE_DOMAIN,
      DASHBOARD_HOST: DASHBOARD_PRIVATE_DOMAIN,
    },
  });

  return project('peretyn', {
    resources: [database, runtime, control, dashboard, gateway],
  });
});
