import { authz, company, document, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'member', object: company('acme') },
    { subject: user('bob'), relation: 'member', object: company('acme') },
    { subject: user('gus'), relation: 'editor', object: document('roadmap') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('gus'), relation: 'can_edit', object: document('roadmap') },
    { subject: user('gus'), relation: 'can_share', object: document('roadmap') },
    { subject: user('bob'), relation: 'can_share', object: document('roadmap') },
  ]),
);
