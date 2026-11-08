import 'vitest';

declare module 'vitest' {
  interface ProvidedContext {
    runtimeUrl: string;
    runtimeInternalUrl: string;
    databaseUrl: string;
    token: string;
  }
}
