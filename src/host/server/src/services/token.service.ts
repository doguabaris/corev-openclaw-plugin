/**
 * @file token.service.ts
 * @description Provides utility functions for creating and verifying JWT tokens.
 * Used primarily in authentication flows (signup, login, whoami).
 *
 * @license MIT
 */

import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');
const TOKEN_EXPIRY = '7d';

/**
 * Generates a signed JWT for the given user ID.
 */
export function signToken(userId: string): string {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verifies a JWT and returns the decoded payload (or null if invalid).
 */
export function verifyToken(token: string): { id: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string };
  } catch {
    return null;
  }
}
