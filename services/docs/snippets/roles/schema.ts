import { any, defineSchema, type, via } from '@peretyn/sdk';

export const schema = defineSchema({
  user: type(),
  platform: type({
    relations: { admin: ['user'] },
  }),
  organization: type({
    relations: { admin: ['user'], member: ['user'] },
  }),
  project: type({
    relations: {
      platform: ['platform'],
      organization: ['organization'],
      admin: ['user'],
      editor: ['user'],
      viewer: ['user'],
    },
    permissions: {
      can_manage: any('admin', via('organization', 'admin'), via('platform', 'admin')),
      can_edit: any('editor', 'can_manage'),
      can_view: any('viewer', 'can_edit', via('organization', 'member')),
    },
  }),
});
