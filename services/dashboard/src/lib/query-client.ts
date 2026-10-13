import { environmentManager, MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { StatusCodes } from 'http-status-codes';
import { ControlError } from './control/client';
import { SIGN_IN_PATH } from './sign-in-path';

const QUERY_STALE_TIME_MS = 5000;
const MAX_QUERY_RETRIES = 3;

let signingIn = false;

function signInOnUnauthorized(error: Error) {
  if (signingIn || !(error instanceof ControlError) || error.status !== StatusCodes.UNAUTHORIZED)
    return;
  signingIn = true;
  const redirectTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`${SIGN_IN_PATH}?redirectTo=${redirectTo}`);
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: signInOnUnauthorized }),
    mutationCache: new MutationCache({ onError: signInOnUnauthorized }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        retry: (failureCount, error) =>
          !(error instanceof ControlError && error.status < StatusCodes.INTERNAL_SERVER_ERROR) &&
          failureCount < MAX_QUERY_RETRIES,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }

  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
