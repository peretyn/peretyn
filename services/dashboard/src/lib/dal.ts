import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverAuthClient } from './auth-client.server';
import { SIGN_IN_PATH } from './sign-in-path';

const getSession = cache(async () =>
  serverAuthClient.getSession({
    fetchOptions: { headers: await headers(), throw: true, timeout: 5000 },
  }),
);

export const verifySession = async () => {
  const session = await getSession();
  if (!session) redirect(SIGN_IN_PATH);
  return session;
};

export const redirectIfAuthenticated = async () => {
  if (await getSession()) redirect('/');
};
