import { authz, document, printVerdicts, team, user } from './helpers.ts';

await authz.write({
  deletes: [{ subject: user('carol'), relation: 'member', object: team('design') }],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('carol'), relation: 'can_view', object: document('roadmap') },
    { subject: user('erin'), relation: 'can_view', object: document('roadmap') },
  ]),
);
