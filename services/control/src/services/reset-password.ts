import { Result } from '@praha/byethrow';
import { auth } from '../auth.js';
import { DatabaseError } from '../db/database.error.js';
import { InvalidPasswordError } from '../errors/invalid-password.error.js';
import { NotFoundError } from '../errors/not-found.error.js';

type PasswordReset = { email: string; password: string };
type AuthContext = Awaited<typeof auth.$context>;
type ResetError = NotFoundError | InvalidPasswordError | DatabaseError;

export async function resetPassword(reset: PasswordReset): Result.ResultAsync<void, ResetError> {
  const context = await auth.$context;
  return Result.pipe(
    validatePassword(context, reset.password),
    Result.andThen(() => findUserId(context, reset.email)),
    Result.andThen((userId) => replacePassword(context, { userId, password: reset.password })),
  );
}

function validatePassword(
  context: AuthContext,
  password: string,
): Result.Result<void, InvalidPasswordError> {
  const { minPasswordLength: minLength, maxPasswordLength: maxLength } = context.password.config;
  if (password.length < minLength || password.length > maxLength) {
    return Result.fail(new InvalidPasswordError({ minLength, maxLength }));
  }
  return Result.succeed();
}

function findUserId(
  context: AuthContext,
  email: string,
): Result.ResultAsync<string, NotFoundError | DatabaseError> {
  return Result.pipe(
    Result.try({
      try: () => context.internalAdapter.findUserByEmail(email.toLowerCase()),
      catch: (error) =>
        new DatabaseError({ entity: 'user', operation: 'read', error: error as Error }),
    }),
    Result.andThen((found) =>
      found ? Result.succeed(found.user.id) : Result.fail(new NotFoundError({ entity: 'user' })),
    ),
  );
}

function replacePassword(
  context: AuthContext,
  { userId, password }: { userId: string; password: string },
): Result.ResultAsync<void, DatabaseError> {
  return Result.try({
    try: async () => {
      await context.internalAdapter.updatePassword(userId, await context.password.hash(password));
      await context.internalAdapter.deleteUserSessions(userId);
    },
    catch: (error) =>
      new DatabaseError({ entity: 'user', operation: 'write', error: error as Error }),
  });
}
