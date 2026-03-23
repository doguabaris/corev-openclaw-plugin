/**
 * @file authenticated-request.interface.ts
 * @description Extends Express `Request` to include authenticated user metadata.
 *
 * This interface is used throughout the Corev Host API to type `req` objects
 * that have been passed through the `authenticate` middleware.
 *
 * After successful authentication (via token or secret), `req.auth` is set to:
 * ```ts
 * { id: string } // user ID from MongoDB (_id as string)
 * ```
 *
 * This ensures type-safe access to `req.auth?.id` in controller functions,
 * enabling cleaner logic and consistent security checks.
 *
 * Example usage:
 * ```ts
 * import { AuthenticatedRequest } from '@interfaces/authenticated-request.interface';
 *
 * export async function getProject(req: AuthenticatedRequest, res: Response) {
 *   const userId = req.auth?.id;
 *   ...
 * }
 * ```
 *
 * @see auth.middleware.ts → sets the `auth` property
 * @see user.model.ts → where user `_id` comes from
 * @author Doğu Abaris
 * @license MIT
 */

import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  auth?: { id: string };
}
