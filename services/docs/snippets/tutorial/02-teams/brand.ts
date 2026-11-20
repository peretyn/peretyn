import { authz, document, membersOf, printVerdicts, team, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('dan'), relation: 'member', object: team('brand') },
    { subject: membersOf('brand'), relation: 'member', object: team('design') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('dan'), relation: 'can_view', object: document('roadmap') },
  ]),
);
