import { authz, company, document, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [{ subject: user('hana'), relation: 'admin', object: company('globex') }],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('hana'), relation: 'can_view', object: document('roadmap') },
    { subject: user('ivan'), relation: 'can_view', object: document('roadmap') },
  ]),
);
