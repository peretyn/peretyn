import { authz, document, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'owner', object: document('roadmap') },
    { subject: user('bob'), relation: 'viewer', object: document('roadmap') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('alice'), relation: 'can_view', object: document('roadmap') },
    { subject: user('bob'), relation: 'can_view', object: document('roadmap') },
    { subject: user('carol'), relation: 'can_view', object: document('roadmap') },
  ]),
);
