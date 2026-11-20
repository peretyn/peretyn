import { authz, document, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [{ subject: user('bob'), relation: 'editor', object: document('roadmap') }],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('bob'), relation: 'can_edit', object: document('roadmap') },
    { subject: user('alice'), relation: 'can_edit', object: document('roadmap') },
    { subject: user('alice'), relation: 'can_view', object: document('roadmap') },
  ]),
);
