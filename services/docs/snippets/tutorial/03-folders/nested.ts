import { authz, document, folder, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: folder('product'), relation: 'parent', object: folder('q3') },
    { subject: folder('q3'), relation: 'parent', object: document('launch-plan') },
    { subject: user('alice'), relation: 'owner', object: document('launch-plan') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('frank'), relation: 'can_view', object: folder('q3') },
    { subject: user('frank'), relation: 'can_view', object: document('launch-plan') },
  ]),
);
