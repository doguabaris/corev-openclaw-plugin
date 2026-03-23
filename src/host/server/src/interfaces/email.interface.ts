/**
 * @file email.interface.ts
 * @description Defines types for email-related services in the Corev Host API.
 *
 * Used primarily by `email.service.ts` to enforce type-safe inputs
 * for sending transactional messages such as password reset tokens.
 *
 * @example
 * import { SendResetTokenOptions } from '@interfaces/email.interface';
 *
 * await sendResetToken({
 *   email: 'someone@example.com',
 *   token: 'abcd1234',
 *   expires: new Date(Date.now() + 1800000)
 * });
 *
 * @see email.service.ts
 * @license MIT
 * @author Doğu Abaris
 */

export interface SendResetTokenOptions {
  email: string;
  token: string;
  expires: Date;
}
