import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Result } from '@praha/byethrow';
import { guardAdminUserRemoval } from './admin-removal-guard.js';
import * as memberRepository from '../repositories/member.repository.js';
import { SoleOwnerError } from '../errors/sole-owner.error.js';
import { DatabaseError } from '../db/database.error.js';

const REMOVE_USER_PATH = '/admin/remove-user';
const TARGET_ID = 'u_target';
const soleOwnerMembers = [
  { organizationId: 'a', organizationName: 'Acme', userId: TARGET_ID, role: 'owner' },
];

function sessionFor(role: string | null, id = 'u_caller') {
  return () => Promise.resolve({ user: { id, role } });
}

describe('guardAdminUserRemoval', () => {
  let getMembers: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getMembers = vi
      .spyOn(memberRepository, 'getMembersOfUserOrganizations')
      .mockResolvedValue(Result.succeed(soleOwnerMembers));
  });

  afterEach(() => vi.restoreAllMocks());

  it('refuses an admin removing a sole owner', async () => {
    const guard = guardAdminUserRemoval({
      path: REMOVE_USER_PATH,
      body: { userId: TARGET_ID },
      getSession: sessionFor('admin'),
    });
    expect(Result.unwrapError(await guard)).toBeInstanceOf(SoleOwnerError);
  });

  it('fails with a session read error rather than letting the removal through', async () => {
    const guard = guardAdminUserRemoval({
      path: REMOVE_USER_PATH,
      body: { userId: TARGET_ID },
      getSession: () => Promise.reject(new Error('database down')),
    });
    expect(Result.unwrapError(await guard)).toBeInstanceOf(DatabaseError);
    expect(getMembers).not.toHaveBeenCalled();
  });

  it('lets an admin remove a user who owns nothing alone', async () => {
    getMembers.mockResolvedValue(Result.succeed([]));
    const guard = guardAdminUserRemoval({
      path: REMOVE_USER_PATH,
      body: { userId: TARGET_ID },
      getSession: sessionFor('admin'),
    });
    expect(Result.isSuccess(await guard)).toBe(true);
  });

  it.each([
    ['an unauthenticated caller', () => Promise.resolve(null)],
    ['a non-admin caller', sessionFor('user')],
    ['a caller with no role', sessionFor(null)],
  ])('reveals nothing to %s and leaves the endpoint to answer', async (_, getSession) => {
    const guard = guardAdminUserRemoval({
      path: REMOVE_USER_PATH,
      body: { userId: TARGET_ID },
      getSession,
    });
    expect(Result.isSuccess(await guard)).toBe(true);
    expect(getMembers).not.toHaveBeenCalled();
  });

  it('ignores other paths without reading the session', async () => {
    const getSession = vi.fn(sessionFor('admin'));
    await guardAdminUserRemoval({
      path: '/admin/ban-user',
      body: { userId: TARGET_ID },
      getSession,
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(getMembers).not.toHaveBeenCalled();
  });

  it('leaves a body without a userId to the endpoint validation', async () => {
    const guard = guardAdminUserRemoval({
      path: REMOVE_USER_PATH,
      body: {},
      getSession: sessionFor('admin'),
    });
    expect(Result.isSuccess(await guard)).toBe(true);
    expect(getMembers).not.toHaveBeenCalled();
  });
});
