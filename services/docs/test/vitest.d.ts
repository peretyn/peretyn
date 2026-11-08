import 'vitest';

declare module 'vitest' {
  interface ProvidedContext {
    docsUrl: string;
  }
}
