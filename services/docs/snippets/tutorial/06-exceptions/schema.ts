import { any, defineSchema, exclude, intersect, type, via } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  team: type({
    relations: { member: ['user', 'team#member'] },
  }),
  organization: type({
    relations: { admin: ['user'], member: ['user'] },
  }),
  folder: type({
    relations: {
      owner: ['user'],
      viewer: ['user', 'team#member'],
      parent: ['folder'],
    },
    permissions: {
      can_view: any('owner', 'viewer', via('parent', 'can_view')),
    },
  }),
  document: type({
    relations: {
      owner: ['user'],
      editor: ['user'],
      viewer: ['user', 'team#member', 'user:*'],
      parent: ['folder'],
      organization: ['organization'],
      blocked: ['user'],
    },
    permissions: {
      can_edit: exclude(any('owner', 'editor'), 'blocked'),
      can_view: exclude(
        any('viewer', 'can_edit', via('parent', 'can_view'), via('organization', 'admin')),
        'blocked',
      ),
      can_share: intersect('can_edit', via('organization', 'member')),
    },
  }),
});
