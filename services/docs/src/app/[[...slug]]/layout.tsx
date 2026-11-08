import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { Logo } from '@/components/logo';
import { source } from '@/lib/source';

const GITHUB_URL = 'https://github.com/peretyn/peretyn';

export default function Layout({ children }: LayoutProps<'/[[...slug]]'>) {
  return (
    <DocsLayout tree={source.getPageTree()} nav={{ title: <Logo /> }} githubUrl={GITHUB_URL}>
      {children}
    </DocsLayout>
  );
}
