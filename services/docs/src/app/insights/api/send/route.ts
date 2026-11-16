import { relayCollect } from '@/lib/analytics/proxy';

export function POST(request: Request) {
  return relayCollect(request);
}
