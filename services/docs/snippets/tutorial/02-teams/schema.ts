import { any, defineSchema, type } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  team: type({
    relations: { member: ['user', 'team#member'] },
  }),
  document: type({
    relations: {
      owner: ['user'],
      editor: ['user'],
      viewer: ['user', 'team#member'],
    },
    permissions: {
      can_edit: any('owner', 'editor'),
      can_view: any('viewer', 'can_edit'),
    },
  }),
});
