import 'vitest';

declare module 'vitest' {
  interface ProvidedContext {
    runtimeUrl: string;
    databaseUrl: string;
    token: string;
  }
}
