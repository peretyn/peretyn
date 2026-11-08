import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { OpenAPIPage } from '@/components/api-page';
import { getMDXComponents } from '@/components/mdx';
import { source } from '@/lib/source';

type DocsPageEntry = NonNullable<ReturnType<typeof source.getPage>>;

export default async function Page({ params }: PageProps<'/[[...slug]]'>) {
  const page = source.getPage((await params).slug);
  if (!page) notFound();

  return page.type === 'openapi' ? <ReferencePage page={page} /> : <ContentPage page={page} />;
}

function ReferencePage({ page }: { page: Extract<DocsPageEntry, { type: 'openapi' }> }) {
  return (
    <DocsPage full>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsBody>
        <OpenAPIPage {...page.data.getOpenAPIPageProps()} />
      </DocsBody>
    </DocsPage>
  );
}

function ContentPage({ page }: { page: Exclude<DocsPageEntry, { type: 'openapi' }> }) {
  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps<'/[[...slug]]'>): Promise<Metadata> {
  const page = source.getPage((await params).slug);
  if (!page) notFound();

  return { title: page.data.title, description: page.data.description };
}
