import { any, defineSchema, type } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  document: type({
    relations: { owner: ['user'], editor: ['user'], viewer: ['user'] },
    permissions: {
      can_edit: any('owner', 'editor'),
      can_view: any('owner', 'editor', 'viewer'),
    },
  }),
});
