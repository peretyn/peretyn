import { authz, document, folder, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'owner', object: folder('leadership') },
    { subject: folder('leadership'), relation: 'parent', object: document('launch-plan') },
  ],
  deletes: [{ subject: folder('q3'), relation: 'parent', object: document('launch-plan') }],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('frank'), relation: 'can_view', object: document('launch-plan') },
    { subject: user('alice'), relation: 'can_view', object: document('launch-plan') },
  ]),
);
