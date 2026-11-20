import { authz, document, printVerdicts, team, user } from './helpers.ts';

await authz.write({
  writes: [{ subject: user('erin'), relation: 'member', object: team('design') }],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('erin'), relation: 'can_view', object: document('roadmap') },
  ]),
);
