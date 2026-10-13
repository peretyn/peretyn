import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const [schemaPath, exportName = 'schema', outPath] = process.argv.slice(2);
if (!schemaPath || !outPath) {
  process.stderr.write('peretyn-runner: schema path and output path required\n');
  process.exit(1);
}

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
