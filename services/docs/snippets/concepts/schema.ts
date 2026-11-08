import { any, defineSchema, type, via } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  team: type({
    relations: { member: ['user'] },
  }),
  folder: type({
    relations: { viewer: ['user', 'team#member'] },
  }),
  document: type({
    relations: { parent: ['folder'], owner: ['user'] },
    permissions: { can_view: any('owner', via('parent', 'viewer')) },
  }),
});
