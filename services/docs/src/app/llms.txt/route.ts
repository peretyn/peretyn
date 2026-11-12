import { llms } from 'fumadocs-core/source';
import { DOCS_ORIGIN } from '@/lib/site';
import { source } from '@/lib/source';

export const revalidate = false;

const SUMMARY = `# Peretyn

> Relationship-based authorization for TypeScript, powered by OpenFGA. You write the model with \`defineSchema\`, publish it with the \`peretyn\` CLI, and check access with the TypeScript SDK or the HTTP API.

## Install

- Self-hosted server: \`curl -fsSL https://peretyn.dev/install | sh\`
- CLI: \`curl -fsSL https://peretyn.dev/install-cli | sh\`
- TypeScript SDK: \`npm install @peretyn/sdk\`
`;

const docsIndex = llms(source, { renderUrl: (item) => new URL(item.url, DOCS_ORIGIN).href });

function renderDocsSection(): string {
  const entries = source.getPageTree().children.map((node) => docsIndex.indexNode(node));
  return `## Docs\n\n${entries.join('\n')}\n`;
}

export function GET() {
  return new Response(`${SUMMARY}\n${renderDocsSection()}`, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}
