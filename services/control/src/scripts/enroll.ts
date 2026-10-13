import { auth } from '../auth.js';
import { log } from '../lib/log.js';

const [email, password, ...rest] = process.argv.slice(2);
const makeAdmin = rest.includes('--admin');

if (!email || !password) {
  console.error('usage: enroll <email> <password> [name] [--admin]');
  process.exit(1);
}

const { minPasswordLength } = (await auth.$context).password.config;
if (password.length < minPasswordLength) {
  console.error(`password must be at least ${minPasswordLength} characters`);
  process.exit(1);
}

const name = rest.find((a) => !a.startsWith('--')) ?? email.split('@')[0]!;

await auth.api.createUser({
  body: { email, password, name, ...(makeAdmin && { role: 'admin' }) },
});

log('user_enrolled', { email, admin: makeAdmin });
process.exit(0);
