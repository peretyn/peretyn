import type { AuthEmail, RenderedEmail } from './auth-email.js';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const IGNORE_NOTICE = 'If you did not expect this email, you can ignore it.';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!);
}

export function renderAuthEmail(
  { to, subject, url, intro = subject, footer = IGNORE_NOTICE }: AuthEmail,
  from: string,
): RenderedEmail {
  const text = `${intro}\n\nOpen this link to continue:\n${url}\n\n${footer}\n`;
  const html =
    `<p>${escapeHtml(intro)}</p>` +
    `<p><a href="${escapeHtml(url)}">Continue</a></p>` +
    `<p>Or open this link: ${escapeHtml(url)}</p>` +
    `<p>${escapeHtml(footer)}</p>`;
  return { from, to, subject, text, html };
}
