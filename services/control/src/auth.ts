import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from './db/index.js';
import { admin, organization } from 'better-auth/plugins';
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { sendAuthEmail } from './lib/email.js';
import { Result } from '@praha/byethrow';
import { ensureNotSoleOwner } from './services/sole-ownership.js';
import { guardAdminUserRemoval } from './services/admin-removal-guard.js';
import { releaseOrganization } from './services/organization-deletion.js';
import { unwrapOrThrowAuthError } from './lib/auth-error.js';
import { keepActiveOrganization } from './lib/auth-session.js';

const MIN_SECRET_LENGTH = 32;

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < MIN_SECRET_LENGTH) {
  throw new Error('BETTER_AUTH_SECRET is required and must be at least 32 characters');
}

const dashboardUrl = process.env.PERETYN_DASHBOARD_URL ?? 'http://localhost:3000';

const adminPlugin = admin();

export const auth = betterAuth({
  secret,
  baseURL: dashboardUrl,
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for'],
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 5 },
    },
  },
  database: drizzleAdapter(db(), {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.PERETYN_ALLOW_SIGNUP !== 'true',
    requireEmailVerification: true,
    sendResetPassword: ({ user, url }) =>
      unwrapOrThrowAuthError(
        sendAuthEmail({ to: user.email, subject: 'Reset your password', url }),
      ),
    onPasswordReset: ({ user }) =>
      unwrapOrThrowAuthError(
        sendAuthEmail({
          to: user.email,
          subject: 'Your Peretyn password was changed',
          intro: 'Your Peretyn password was just reset.',
          url: `${dashboardUrl}/auth/forgot-password`,
          footer: 'If this was not you, reset your password again right away.',
        }),
      ),
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: ({ user, url }) =>
      unwrapOrThrowAuthError(sendAuthEmail({ to: user.email, subject: 'Verify your email', url })),
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: ({ user, newEmail, url }) =>
        unwrapOrThrowAuthError(
          sendAuthEmail({
            to: user.email,
            subject: 'Confirm your email change',
            intro: `Confirm changing your Peretyn email to ${newEmail}.`,
            url,
          }),
        ),
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: ({ user, url }) =>
        unwrapOrThrowAuthError(
          sendAuthEmail({
            to: user.email,
            subject: 'Confirm deleting your Peretyn account',
            intro: 'Confirm deleting your Peretyn account. This cannot be undone.',
            url,
          }),
        ),
      beforeDelete: (user) => unwrapOrThrowAuthError(ensureNotSoleOwner(user.id)),
    },
  },
  hooks: {
    before: createAuthMiddleware((ctx) =>
      unwrapOrThrowAuthError(
        guardAdminUserRemoval({
          path: ctx.path,
          body: ctx.body,
          getSession: () => getSessionFromCtx(ctx),
          adminOptions: adminPlugin.options,
        }),
      ),
    ),
  },
  plugins: [
    adminPlugin,
    organization({
      sendInvitationEmail: ({ invitation, organization: org }) =>
        unwrapOrThrowAuthError(
          sendAuthEmail({
            to: invitation.email,
            subject: `You have been invited to ${org.name} on Peretyn`,
            url: `${dashboardUrl}/accept-invitation/${invitation.id}`,
          }),
        ),
      organizationHooks: {
        beforeDeleteOrganization: ({ organization: org }, ctx) =>
          unwrapOrThrowAuthError(
            Result.pipe(
              releaseOrganization(org.id),
              Result.orThrough(() => keepActiveOrganization(org.id, ctx)),
            ),
          ),
      },
    }),
  ],
});
