/**
 * @file auth.middleware.ts
 * @description Express middleware for authenticating Corev API requests.
 *
 * Supports two authentication modes:
 *   1. Bearer Token — typically issued during login and sent via `Authorization` header.
 *   2. API Secret — provided by CLI clients via `x-corev-secret` header.
 *
 * If authentication succeeds, attaches `req.auth = { id: <userId> }` for downstream use.
 *
 * This middleware is used to protect all config, log, and project routes within the corev.host API.
 * It is compatible with both CLI and web-based clients.
 *
 * Example CLI usage:
 *   corev push configs/atlas@1.0.0.json
 *   → sends `x-corev-secret: <token>` to the API
 *
 * @returns 401 if no valid token or secret is provided.
 *
 * @see token.service.ts → verifyToken()
 * @see AuthenticatedRequest interface → for downstream type safety
 * @see user.model.ts → where `apiSecret` is stored
 *
 * @author Doğu Abaris
 * @license MIT
 */

import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '@interfaces/authenticated-request.interface';
import { verifyToken } from '../../services/token.service';
import { User } from '../../models/user.model';

/**
 * Authenticates incoming requests via either a Bearer token or CLI-provided API secret.
 *
 * This middleware protects all Corev API routes that require user authentication.
 * It supports both UI and CLI clients:
 *
 * - UI/Web clients send a Bearer token in the `Authorization` header (e.g., `Bearer <token>`).
 * - CLI clients send an `apiSecret` token via the `x-corev-secret` header.
 *
 * On successful authentication, it attaches `req.auth = { id: <userId> }` for downstream use.
 * If no valid token or secret is provided, it returns a `401 Unauthorized` response.
 *
 * This middleware should be applied to all config, log, and project routes in the Corev Host API.
 *
 * @function
 * @param  req - Express request object (may include `Authorization` or `x-corev-secret`).
 * @param  res - Express response object.
 * @param  next - Express next function for continuing middleware chain.
 * @returns  Sends 401 response if unauthorized; otherwise calls `next()`.
 *
 * @example
 *   // UI client with Bearer token:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
 *
 *   // CLI client with secret:
 *   x-corev-secret: sk_live_abc123
 *
 * @see    verifyToken() in token.service.ts
 * @see    User model (`apiSecret` field)
 * @see    AuthenticatedRequest interface
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const secretHeader = req.headers['x-corev-secret'];
  const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      (req as AuthenticatedRequest).auth = { id: decoded.id };
      return next();
    }
  }

  if (typeof secret === 'string' && secret.trim()) {
    const normalizedSecret = secret.trim();
    const user = await User.findOne().where('apiSecret').equals(normalizedSecret);
    if (user) {
      (req as AuthenticatedRequest).auth = { id: user._id.toString() };
      return next();
    }
  }

  return res.status(401).json({ message: 'Unauthorized (token or valid secret required)' });
}
