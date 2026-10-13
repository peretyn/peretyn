import { describe, expect, it } from 'vitest';
import { sameOriginPath } from './same-origin-path';

describe('sameOriginPath', () => {
  it.each(['/', '/projects/p1/overview?env=development', '/organization/people#members'])(
    'keeps the same-origin path %s',
    (value) => {
      expect(sameOriginPath(value)).toBe(value);
    },
  );

  it.each([
    undefined,
    '',
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    'projects/p1',
    ['/projects', '//evil.example'],
  ])('rejects %j', (value) => {
    expect(sameOriginPath(value)).toBeUndefined();
  });
});
