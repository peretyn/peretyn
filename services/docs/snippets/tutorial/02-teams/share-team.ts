import { authz, document, membersOf, printVerdicts, team, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('carol'), relation: 'member', object: team('design') },
    { subject: membersOf('design'), relation: 'viewer', object: document('roadmap') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('carol'), relation: 'can_view', object: document('roadmap') },
    { subject: user('carol'), relation: 'can_edit', object: document('roadmap') },
    { subject: user('bob'), relation: 'can_edit', object: document('roadmap') },
  ]),
);
