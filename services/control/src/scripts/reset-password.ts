import { Result } from '@praha/byethrow';
import { resetPassword } from '../services/reset-password.js';
import { log } from '../lib/log.js';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('usage: reset-password <email> <new-password>');
  process.exit(1);
}

const result = await resetPassword({ email, password });
if (Result.isFailure(result)) {
  console.error(`could not reset the password: ${result.error.message}`);
  process.exit(1);
}

log('password_reset', { email });
process.exit(0);
