import { ErrorFactory } from '@praha/error-factory';

export class InvalidPasswordError extends ErrorFactory({
  name: 'InvalidPasswordError',
  message: ({ minLength, maxLength }) =>
    `password must be ${minLength} to ${maxLength} characters long`,
  fields: ErrorFactory.fields<{ minLength: number; maxLength: number }>(),
}) {}
