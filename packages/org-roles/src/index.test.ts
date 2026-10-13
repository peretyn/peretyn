import { describe, expect, it } from 'vitest';
import { isOwnerRole } from './index.js';

describe('isOwnerRole', () => {
  it.each(['owner', 'owner,admin', 'admin,owner', 'admin, owner', ' owner '])(
    'counts %j as owner, like better-auth',
    (role) => expect(isOwnerRole(role)).toBe(true),
  );

  it.each(['admin', 'member', 'admin,member', 'owners', 'co-owner', 'Owner', ''])(
    'does not count %j as owner',
    (role) => expect(isOwnerRole(role)).toBe(false),
  );

  it.each([null, undefined])('does not count a missing role (%s) as owner', (role) =>
    expect(isOwnerRole(role)).toBe(false),
  );
});
