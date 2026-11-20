import { authz, company, document, folder, printVerdicts, user } from './helpers.ts';

await authz.write({
  writes: [
    { subject: user('alice'), relation: 'owner', object: document('team-reviews') },
    { subject: folder('product'), relation: 'parent', object: document('team-reviews') },
    { subject: company('acme'), relation: 'company', object: document('team-reviews') },
    { subject: user('frank'), relation: 'blocked', object: document('team-reviews') },
  ],
});

printVerdicts(
  await authz.batchCheck([
    { subject: user('frank'), relation: 'can_view', object: document('team-reviews') },
    { subject: user('frank'), relation: 'can_view', object: document('roadmap') },
    { subject: user('ivan'), relation: 'can_view', object: document('team-reviews') },
  ]),
);
