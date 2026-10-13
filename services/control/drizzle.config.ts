import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  schemaFilter: ['peretyn_control'],
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? 'postgres://peretyn:peretyn_dev_password@localhost:55432/peretyn',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
