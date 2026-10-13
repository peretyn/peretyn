import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 md:p-6">
      <Logo />
      {children}
    </div>
  );
}
