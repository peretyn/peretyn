import { authz, document, folder, membersOf, printVerdicts, team, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'owner', object: folder('product') },
    { subject: user('frank'), relation: 'member', object: team('engineering') },
    { subject: membersOf('engineering'), relation: 'viewer', object: folder('product') },
    { subject: folder('product'), relation: 'parent', object: document('roadmap') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('frank'), relation: 'can_view', object: document('roadmap') },
    { subject: user('frank'), relation: 'can_edit', object: document('roadmap') },
  ]),
);
