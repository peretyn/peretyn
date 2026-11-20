import { any, defineSchema, type, via } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  team: type({
    relations: { member: ['user', 'team#member'] },
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
      viewer: ['user', 'team#member'],
      parent: ['folder'],
    },
    permissions: {
      can_edit: any('owner', 'editor'),
      can_view: any('viewer', 'can_edit', via('parent', 'can_view')),
    },
  }),
});
