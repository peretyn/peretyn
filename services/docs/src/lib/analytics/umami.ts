import { DOCS_ORIGIN } from '../site';

export const UMAMI_WEBSITE_ID = '12b77838-bf6a-49d0-900f-1977401fab6c';
export const UMAMI_TRACKER_URL = 'https://cloud.umami.is/script.js';
export const UMAMI_COLLECT_URL = 'https://gateway.umami.is/api/send';

export const ANALYTICS_PROXY_PATH = '/insights';
export const PROXIED_TRACKER_PATH = `${ANALYTICS_PROXY_PATH}/script.js`;
export const TRACKED_HOSTNAME = new URL(DOCS_ORIGIN).hostname;
