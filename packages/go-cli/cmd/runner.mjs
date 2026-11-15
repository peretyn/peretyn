import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';

const SCHEMA_ERROR = 'PeretynSchemaError';
const SCHEMA_ERROR_EXIT_CODE = 2;

const [schemaPath, exportName = 'schema', outPath] = process.argv.slice(2);
if (!schemaPath || !outPath) {
  process.stderr.write('peretyn-runner: schema path and output path required\n');
  process.exit(1);
}

try {
  await compile();
} catch (error) {
  if (error?.name !== SCHEMA_ERROR) throw error;
  process.stderr.write(`${locate(error)}: ${error.message}\n`);
  process.exit(SCHEMA_ERROR_EXIT_CODE);
}

async function compile() {
  const require = createRequire(schemaPath);
  const { schemaToOpenFGA, schemaToDsl } = await import(
    pathToFileURL(require.resolve('@peretyn/sdk')).href
  );

  const mod = await import(pathToFileURL(schemaPath).href);
  const schema = mod[exportName] ?? mod.default;

  if (!schema || typeof schema !== 'object') {
    process.stderr.write(
      `peretyn-runner: no usable export (looked for "${exportName}" then default)\n`,
    );
    process.exit(1);
  }

  writeFileSync(
    outPath,
    JSON.stringify({
      model: schemaToOpenFGA(schema),
      dsl: schemaToDsl(schema),
    }),
  );
}

function locate({ typeName, token }) {
  const file = relative(process.cwd(), schemaPath);
  const source = readFileSync(schemaPath, 'utf8');
  const typeStart = findKey(source, typeName);
  const tokenStart = findQuoted(source, token, Math.max(0, typeStart));
  const offset = tokenStart >= 0 ? tokenStart : typeStart;
  if (offset < 0) return file;
  const linesBefore = source.slice(0, offset).split('\n');
  return `${file}:${linesBefore.length}:${linesBefore.at(-1).length + 1}`;
}

function findKey(source, name) {
  const match = new RegExp(`(^|[\\s{,])(['"]?)${escapeRegExp(name)}\\2\\s*:`, 'm').exec(source);
  return match ? match.index + match[1].length : -1;
}

function findQuoted(source, token, from) {
  const match = new RegExp(`(['"\`])${escapeRegExp(token)}\\1`).exec(source.slice(from));
  return match ? from + match.index + 1 : -1;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
