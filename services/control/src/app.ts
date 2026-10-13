import { StatusCodes } from 'http-status-codes';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { auth } from './auth.js';
import { projectsRoute } from './routes/projects.js';
import { keysRoute } from './routes/keys.js';
import { schemasRoute } from './routes/schemas.js';
import { dataPlaneRoute } from './routes/data-plane.js';
import { publishRoute } from './routes/publish.js';
import { protectRoute, type AuthVariables } from './middleware/protect-route.js';
import { accessLog } from './middleware/access-log.js';
import { logError } from './lib/log.js';

const BYTES_PER_KIBIBYTE = 1024;
const MAX_REQUEST_BODY_BYTES = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;

export const app = new Hono<{ Variables: AuthVariables }>();

app.use('*', accessLog);
app.use(
  '*',
  bodyLimit({
    maxSize: MAX_REQUEST_BODY_BYTES,
    onError: (c) => c.json({ message: 'request body too large' }, StatusCodes.REQUEST_TOO_LONG),
  }),
);

app.get('/healthz', (c) => c.json({ status: 'ok' }));

app.use('/manage/*', protectRoute);

app.route('/manage/v1/projects', projectsRoute);
app.route('/manage/v1/projects', keysRoute);
app.route('/manage/v1/projects', schemasRoute);
app.route('/manage/v1/projects', dataPlaneRoute);

app.route('/publish/v1', publishRoute);

app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  logError('unhandled error', { method: c.req.method, error, stack: error.stack });
  return c.json({ message: 'internal error' }, StatusCodes.INTERNAL_SERVER_ERROR);
});
