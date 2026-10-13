import { afterEach, describe, expect, it, vi } from 'vitest';
import { Result } from '@praha/byethrow';
import { ensureNotSoleOwner, findSoleOwnedOrganizations } from './sole-ownership.js';
import { SoleOwnerError } from '../errors/sole-owner.error.js';
import * as memberRepository from '../repositories/member.repository.js';
import { DatabaseError } from '../db/database.error.js';

const USER_ID = 'u_leaving';

function member(organizationId: string, userId: string, role: string) {
  return { organizationId, organizationName: `Org ${organizationId}`, userId, role };
}

describe('findSoleOwnedOrganizations', () => {
  it('finds an organization the user alone owns', () => {
    const members = [member('a', USER_ID, 'owner'), member('a', 'u_2', 'member')];
    expect(findSoleOwnedOrganizations(USER_ID, members)).toEqual([{ id: 'a', name: 'Org a' }]);
  });

  it('counts owner among several roles for the user', () => {
    const members = [member('a', USER_ID, 'owner,admin'), member('a', 'u_2', 'admin')];
    expect(findSoleOwnedOrganizations(USER_ID, members)).toEqual([{ id: 'a', name: 'Org a' }]);
  });

  it.each(['owner', 'admin,owner'])('skips an organization with another %j member', (role) => {
    const members = [member('a', USER_ID, 'owner'), member('a', 'u_2', role)];
    expect(findSoleOwnedOrganizations(USER_ID, members)).toEqual([]);
  });

  it('skips organizations the user does not own', () => {
    const members = [member('a', USER_ID, 'admin'), member('a', 'u_2', 'owner')];
    expect(findSoleOwnedOrganizations(USER_ID, members)).toEqual([]);
  });

  it('finds nothing for a user in no organization', () => {
    expect(findSoleOwnedOrganizations(USER_ID, [])).toEqual([]);
  });

  it('returns only the solely owned ones among several organizations', () => {
    const members = [
      member('a', USER_ID, 'owner'),
      member('b', USER_ID, 'owner'),
      member('b', 'u_2', 'owner'),
      member('c', USER_ID, 'owner'),
    ];
    expect(findSoleOwnedOrganizations(USER_ID, members).map((o) => o.id)).toEqual(['a', 'c']);
  });
});

describe('ensureNotSoleOwner', () => {
  afterEach(() => vi.restoreAllMocks());

  function mockMembers(members: ReturnType<typeof member>[]) {
    vi.spyOn(memberRepository, 'getMembersOfUserOrganizations').mockResolvedValue(
      Result.succeed(members),
    );
  }

  it('fails naming every solely owned organization and the way out', async () => {
    mockMembers([member('a', USER_ID, 'owner'), member('c', USER_ID, 'owner')]);
    const result = await ensureNotSoleOwner(USER_ID);
    expect(Result.isFailure(result)).toBe(true);
    const error = Result.unwrapError(result);
    expect(error).toBeInstanceOf(SoleOwnerError);
    expect(error.message).toContain('Org a');
    expect(error.message).toContain('Org c');
    expect(error.message).toMatch(/owner/);
    expect(error.message).toMatch(/delete/);
  });

  it('succeeds for a user who shares ownership', async () => {
    mockMembers([member('a', USER_ID, 'owner'), member('a', 'u_2', 'owner')]);
    expect(Result.isSuccess(await ensureNotSoleOwner(USER_ID))).toBe(true);
  });

  it('fails rather than proceeds when memberships cannot be read', async () => {
    const readFailure = new DatabaseError({ entity: 'member', operation: 'read' });
    vi.spyOn(memberRepository, 'getMembersOfUserOrganizations').mockResolvedValue(
      Result.fail(readFailure),
    );
    expect(Result.unwrapError(await ensureNotSoleOwner(USER_ID))).toBe(readFailure);
  });
});
