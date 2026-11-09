import { beforeAll, describe, expect, inject, it } from 'vitest';

const INTERNAL_LINK = /href="(\/[^"#?]*)/g;
const SKIPPED_PREFIXES = ['/_next/', '/api/'];
const SECTIONS = ['/quickstart', '/concepts', '/sdk', '/cli', '/self-hosting'];

interface CrawledPage {
  status: number;
  html: string;
}

const pages = new Map<string, CrawledPage>();

function internalLinks(html: string): string[] {
  return [...html.matchAll(INTERNAL_LINK)]
    .map((match) => match[1])
    .filter((path): path is string => path !== undefined && !path.startsWith('//'))
    .filter((path) => !SKIPPED_PREFIXES.some((prefix) => path.startsWith(prefix)));
}

async function crawl(baseUrl: string, start: string): Promise<void> {
  const queue = [start];
  for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
    if (pages.has(path)) continue;
    const response = await fetch(`${baseUrl}${path}`);
    const html = await response.text();
    pages.set(path, { status: response.status, html });
    queue.push(...internalLinks(html));
  }
}

beforeAll(() => crawl(inject('docsUrl'), '/'));

describe('the docs site', () => {
  it('serves every page it links to', () => {
    const broken = [...pages].filter(([, page]) => page.status !== 200).map(([path]) => path);
    expect(broken).toEqual([]);
  });

  it.each(SECTIONS)('links to the %s section', (section) => {
    expect(pages.has(section)).toBe(true);
  });

  it('renders an HTTP API reference page from the OpenAPI spec', () => {
    const referencePages = [...pages].filter(([path]) => path.startsWith('/reference/'));
    expect(referencePages.some(([, page]) => page.html.includes('/v1/check'))).toBe(true);
  });
});
