import { any, defineSchema, type } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  document: type({
    relations: { owner: ['user'], viewer: ['user'] },
    permissions: { can_view: any('owner', 'viewer') },
  }),
});
