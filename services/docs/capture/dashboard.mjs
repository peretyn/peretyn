import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const DASHBOARD_URL = 'http://localhost';
const OUT_DIR = '/out';
const VIEWPORT = { width: 1280, height: 800 };
const DEVICE_SCALE_FACTOR = 2;
const LAST_FRAME_SECONDS = 2;
const FRAME_NAME_DIGITS = 5;
const ADMIN_EMAIL = process.env.CAPTURE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.CAPTURE_ADMIN_PASSWORD;
const SCENE = process.env.CAPTURE_SCENE;
const ORGANIZATION_NAME = 'Acme';
const PROJECT_NAME = 'Quickstart';
const SCHEMA_LABEL = 'v1';
const TYPING_DELAY_MS = 70;
const BEAT_MS = 700;
const HESITATION_BEATS = 0.4;
const READING_BEATS = 3;
const DEVELOPMENT_KEY = /prn_test_[A-Za-z0-9_-]+/;
const CURSOR_POSITION_KEY = 'capture-cursor';

const CURSOR_SCRIPT = `
  (() => {
    const TIP_OFFSET = { x: 5, y: 3 };
    const ARROW = '<svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 2 L4 19.5 L8.6 15.3 L11.6 22 L14.6 20.7 L11.6 14.1 L17.8 14.1 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const saved = JSON.parse(sessionStorage.getItem('${CURSOR_POSITION_KEY}') || 'null');
    let position = saved || { x: innerWidth / 2, y: innerHeight / 2 };
    let cursor;

    const place = () => {
      sessionStorage.setItem('${CURSOR_POSITION_KEY}', JSON.stringify(position));
      if (!cursor) return;
      cursor.style.transform = 'translate(' + (position.x - TIP_OFFSET.x) + 'px,' + (position.y - TIP_OFFSET.y) + 'px)';
    };
    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    window.__captureCursor = {
      moveTo(x, y, duration) {
        const from = { ...position };
        const startedAt = performance.now();
        return new Promise((resolve) => {
          const step = (now) => {
            const progress = duration > 0 ? Math.min((now - startedAt) / duration, 1) : 1;
            const eased = easeInOut(progress);
            position = { x: from.x + (x - from.x) * eased, y: from.y + (y - from.y) * eased };
            place();
            if (progress < 1) requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });
      },
      pulse() {
        const ring = document.createElement('div');
        ring.style.cssText = 'position:fixed;z-index:2147483646;left:' + position.x + 'px;top:' + position.y + 'px;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:2px solid rgba(250,204,21,.9);pointer-events:none;transition:transform .35s ease-out,opacity .35s ease-out';
        document.body.appendChild(ring);
        requestAnimationFrame(() => { ring.style.transform = 'scale(1.6)'; ring.style.opacity = '0'; });
        setTimeout(() => ring.remove(), 400);
      },
    };

    addEventListener('DOMContentLoaded', () => {
      cursor = document.createElement('div');
      cursor.innerHTML = ARROW;
      cursor.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))';
      document.body.appendChild(cursor);
      place();
    });
  })();
`;

function pause(page, beats = 1) {
  return page.waitForTimeout(BEAT_MS * beats);
}

function movementDuration(from, to) {
  const MIN_MS = 350;
  const MAX_MS = 750;
  const MS_PER_PIXEL = 0.6;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.min(Math.max(distance * MS_PER_PIXEL, MIN_MS), MAX_MS);
}

async function cursorPosition(page) {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), CURSOR_POSITION_KEY);
}

async function moveTo(page, locator) {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const duration = movementDuration(await cursorPosition(page), target);
  await page.evaluate(({ x, y, duration }) => window.__captureCursor.moveTo(x, y, duration), {
    ...target,
    duration,
  });
  await page.mouse.move(target.x, target.y);
  return target;
}

async function clickVisibly(page, locator) {
  const target = await moveTo(page, locator);
  await pause(page, HESITATION_BEATS);
  await page.evaluate(() => window.__captureCursor.pulse());
  await page.mouse.click(target.x, target.y);
}

async function typeVisibly(page, locator, text) {
  await clickVisibly(page, locator);
  await locator.pressSequentially(text, { delay: TYPING_DELAY_MS });
}

async function signIn(page) {
  await typeVisibly(page, page.getByLabel('Email'), ADMIN_EMAIL);
  await typeVisibly(page, page.getByLabel('Password'), ADMIN_PASSWORD);
  await pause(page);
  await clickVisibly(page, page.getByRole('button', { name: /sign in|log in|login/i }));
}

async function createOrganization(page) {
  const createButton = { name: 'Create organization' };
  const workspaceSetup = page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Set up your workspace' }) })
    .filter({ has: page.getByRole('button', createButton) })
    .last();
  await clickVisibly(page, workspaceSetup.getByRole('button', createButton));
  await typeVisibly(page, page.locator('#create-organization-name'), ORGANIZATION_NAME);
  await pause(page);
  const organizationForm = page
    .locator('form')
    .filter({ has: page.locator('#create-organization-name') });
  await clickVisibly(page, organizationForm.getByRole('button', createButton));
}

async function createProject(page) {
  await clickVisibly(page, page.getByRole('button', { name: 'New project' }));
  await typeVisibly(page, page.locator('#create-project-name'), PROJECT_NAME);
  await pause(page);
  await clickVisibly(page, page.getByRole('button', { name: 'Create project' }));
}

async function copyDevelopmentKey(page) {
  const copyButton = page.getByRole('button', { name: 'Copy Development key' });
  await copyButton.waitFor({ state: 'visible' });
  await pause(page, 2);
  const developmentKey = await page.getByLabel('Development key').inputValue();
  await clickVisibly(page, copyButton);
  await pause(page, READING_BEATS);
  if (!DEVELOPMENT_KEY.test(developmentKey)) {
    throw new Error('The development key is not on the page.');
  }
  await writeFile(join(OUT_DIR, 'development-key'), developmentKey);
}

async function createProjectScene(page) {
  await signIn(page);
  await createOrganization(page);
  await createProject(page);
  await copyDevelopmentKey(page);
}

async function schemaScene(page) {
  await signIn(page);
  await clickVisibly(page, page.getByRole('link', { name: PROJECT_NAME }));
  await clickVisibly(page, page.getByRole('link', { name: 'Schema' }));
  await clickVisibly(page, page.getByRole('combobox'));
  await clickVisibly(page, page.getByRole('option', { name: 'Development' }));
  await page.getByText(SCHEMA_LABEL, { exact: true }).waitFor({ state: 'visible' });
  await pause(page, READING_BEATS);
}

const SCENES = { 'create-project': createProjectScene, schema: schemaScene };

async function startScreencast(context, page) {
  const frames = [];
  const session = await context.newCDPSession(page);
  session.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    frames.push({ data, timestamp: metadata.timestamp });
    await session.send('Page.screencastFrameAck', { sessionId });
  });
  await session.send('Page.startScreencast', {
    format: 'png',
    maxWidth: VIEWPORT.width * DEVICE_SCALE_FACTOR,
    maxHeight: VIEWPORT.height * DEVICE_SCALE_FACTOR,
  });
  return { frames, stop: () => session.send('Page.stopScreencast') };
}

function frameDuration(frames, index) {
  const next = frames[index + 1];
  return next ? next.timestamp - frames[index].timestamp : LAST_FRAME_SECONDS;
}

async function saveFrames(scene, frames) {
  const dir = join(OUT_DIR, scene);
  await mkdir(dir, { recursive: true });
  const names = frames.map(
    (_, index) => `frame-${String(index).padStart(FRAME_NAME_DIGITS, '0')}.png`,
  );
  await Promise.all(
    names.map((name, index) =>
      writeFile(join(dir, name), Buffer.from(frames[index].data, 'base64')),
    ),
  );
  const entries = names.map(
    (name, index) => `file '${name}'\nduration ${frameDuration(frames, index)}`,
  );
  await writeFile(join(dir, 'frames.txt'), `${entries.join('\n')}\nfile '${names.at(-1)}'\n`);
}

async function playScene(page, scene) {
  return SCENES[scene](page).catch(async (error) => {
    await page.screenshot({ path: join(OUT_DIR, `${scene}-failure.png`) });
    throw error;
  });
}

async function openSignInPage(context) {
  const page = await context.newPage();
  await page.goto(DASHBOARD_URL);
  await page.getByLabel('Email').waitFor({ state: 'visible' });
  return page;
}

async function recordScene(scene) {
  const browser = await chromium.launch({
    args: [`--force-device-scale-factor=${DEVICE_SCALE_FACTOR}`],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    colorScheme: 'dark',
  });
  await context.addInitScript(CURSOR_SCRIPT);
  const page = await openSignInPage(context);
  const screencast = await startScreencast(context, page);
  await pause(page);
  await playScene(page, scene);
  await screencast.stop();
  await browser.close();
  await saveFrames(scene, screencast.frames);
}

await recordScene(SCENE);
