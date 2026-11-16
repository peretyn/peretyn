import { relayTrackerScript } from '@/lib/analytics/proxy';

export const dynamic = 'force-dynamic';

export function GET() {
  return relayTrackerScript();
}
