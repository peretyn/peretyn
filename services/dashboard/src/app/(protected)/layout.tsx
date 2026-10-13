import { cookies } from 'next/headers';
import { AppShell } from '@/components/app-shell';
import { verifySession } from '@/lib/dal';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await verifySession();

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return <AppShell defaultOpen={defaultOpen}>{children}</AppShell>;
}
