import { authz, company, document, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('ivan'), relation: 'admin', object: company('acme') },
    { subject: company('acme'), relation: 'company', object: document('roadmap') },
    { subject: company('acme'), relation: 'company', object: document('launch-plan') },
    { subject: company('acme'), relation: 'company', object: document('announcement') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('ivan'), relation: 'can_view', object: document('roadmap') },
    { subject: user('ivan'), relation: 'can_view', object: document('launch-plan') },
    { subject: user('ivan'), relation: 'can_edit', object: document('roadmap') },
  ]),
);
