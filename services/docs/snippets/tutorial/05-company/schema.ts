import { any, defineSchema, type, via } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  team: type({
    relations: { member: ['user', 'team#member'] },
  }),
  company: type({
    relations: { admin: ['user'] },
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
      company: ['company'],
    },
    permissions: {
      can_edit: any('owner', 'editor'),
      can_view: any('viewer', 'can_edit', via('parent', 'can_view'), via('company', 'admin')),
    },
  }),
});
