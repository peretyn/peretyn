'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@peretyn/ui/components/select';
import { useEnvParam } from '@/lib/control/environments';
import { useIsOrgOwner } from '@/lib/use-is-owner';

export function EnvSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isOwner } = useIsOrgOwner();
  const env = useEnvParam();

  if (isOwner === false) return null;

  const onValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'production') params.delete('env');
    else params.set('env', value);
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  };

  return (
    <Select value={env} onValueChange={onValueChange}>
      <SelectTrigger className="w-44" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="production">Production</SelectItem>
        <SelectItem value="development">Development</SelectItem>
      </SelectContent>
    </Select>
  );
}
