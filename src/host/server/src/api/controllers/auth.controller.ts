/**
 * @file auth.controller.ts
 * @description Implements user authentication and identity management for the Corev Host API.
 *
 * This controller provides route handlers for user signup, login, password reset, identity retrieval,
 * and self-service account management. It supports both CLI and UI clients. CLI clients store tokens
 * in `.corevrc.json`, while UI clients use HTTP cookies or local storage.
 *
 * Supported operations:
 *  - signup: Create a new user account with email and password.
 *  - login: Authenticate user credentials and issue a token.
 *  - forgot-password: Initiate password reset flow by sending a reset token via email.
 *  - reset-password: Complete password reset using a valid token.
 *  - whoami: Retrieve the current user identity based on token.
 *  - updateSelf: Update the authenticated user’s email or password.
 *  - deleteSelf: Permanently delete the authenticated user’s account.
 *
 * These handlers are mounted under the `/api/auth` route prefix, as described in `auth.routes.ts`.
 *
 * @example
 *   POST /api/auth/signup          → Create new user
 *   POST /api/auth/login           → Get token
 *   POST /api/auth/forgot-password → Send reset token
 *   POST /api/auth/reset-password  → Reset password
 *   GET  /api/auth/whoami          → Get current user
 *   PUT  /api/auth/me              → Update self
 *   DELETE /api/auth/me            → Delete self
 *
 * @author      Doğu Abaris <abaris@null.net>
 * @license     MIT
 * @see         README.md for details on Corev usage
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../../models/user.model';
import { signToken } from '../../services/token.service';
import { sendResetToken } from '../../services/email.service';
import { AuthenticatedRequest } from '@interfaces/authenticated-request.interface';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readString(value: unknown, min = 1, max = 320): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length < min || normalized.length > max) return null;
  return normalized;
}

function readEmail(value: unknown): string | null {
  const email = readString(value, 5, 320);
  if (!email) return null;
  const normalized = email.toLowerCase();
  return EMAIL_REGEX.test(normalized) ? normalized : null;
}

/**
 * Handles user registration. Creates a new user if the email does not already exist.
 *
 * Validates that both `email` and `password` are present. Passwords are hashed before saving.
 * Returns a signed token on successful registration.
 *
 * @route  POST /api/auth/signup
 * @access  Public
 * @param  req - Express request with `email` and `password` in the body.
 * @param  res - Express response.
 * @returns  201 Created with token on success, 400 or 409 on failure.
 */
export async function signup(req: Request, res: Response) {
  const email = readEmail(req.body?.email);
  const password = readString(req.body?.password, 6, 128);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const existing = await User.findOne().where('email').equals(email);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({ email, passwordHash });
  await user.save();

  const token = signToken(user._id.toString());
  res.status(201).json({ token });
}

/**
 * Authenticates a user using their email and password.
 *
 * Validates credentials, and returns a signed token if authentication is successful.
 *
 * @route  POST /api/auth/login
 * @access  Public
 * @param  req - Express request with `email` and `password` in the body.
 * @param  res - Express response.
 * @returns  200 OK with token, or 401 Unauthorized on invalid credentials.
 */
export async function login(req: Request, res: Response) {
  const email = readEmail(req.body?.email);
  const password = readString(req.body?.password, 1, 128);

  if (!email || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = await User.findOne().where('email').equals(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user._id.toString());
  res.json({ token });
}

/**
 * Returns the current authenticated user's profile information.
 *
 * Excludes sensitive fields like `passwordHash`. Requires authentication.
 *
 * @route  GET /api/auth/whoami
 * @access  Protected
 * @param  req - Authenticated request with `auth.id` set.
 * @param  res - Express response.
 * @returns  200 OK with user data, or 404 if user is not found.
 */
export async function whoami(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
}

/**
 * Allows the authenticated user to update their own email and/or password.
 *
 * Accepts optional fields `email` and `password`. Passwords are re-hashed before saving.
 *
 * @route  PUT /api/auth/me
 * @access  Protected
 * @param  req - Authenticated request with optional `email` and/or `password` in the body.
 * @param  res - Express response.
 * @returns  200 OK on success, or 404 if user does not exist.
 */
export async function updateSelf(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  const rawEmail = req.body?.email;
  const rawPassword = req.body?.password;
  const email = rawEmail === undefined ? undefined : readEmail(rawEmail);
  const password = rawPassword === undefined ? undefined : readString(rawPassword, 6, 128);

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (rawEmail !== undefined && !email) {
    return res.status(400).json({ error: 'Email must be a valid email address' });
  }
  if (rawPassword !== undefined && !password) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (email) {
    user.email = email;
  }
  if (password) {
    user.passwordHash = await bcrypt.hash(password, 10);
  }

  await user.save();
  res.json({ message: 'User updated' });
}

/**
 * Permanently deletes the authenticated user's account.
 *
 * Once deleted, the user cannot log in again unless re-registered.
 *
 * @route  DELETE /api/auth/me
 * @access  Protected
 * @param  req - Authenticated request.
 * @param  res - Express response.
 * @returns  200 OK with confirmation message.
 */
export async function deleteSelf(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  await User.findByIdAndDelete(userId);
  res.json({ message: 'Account deleted' });
}

/**
 * Initiates a password reset flow for a user by generating a token and emailing it.
 *
 * If the user with the given email exists, a token is stored with expiration,
 * and an email is sent. Otherwise, the response is still 200 to avoid account enumeration.
 *
 * @route  POST /api/auth/forgot-password
 * @access  Public
 * @param  req - Express request with `email` in the body.
 * @param  res - Express response.
 * @returns  200 OK always, regardless of whether the user exists.
 */
export async function forgotPassword(req: Request, res: Response) {
  const email = readEmail(req.body?.email);
  if (!email) {
    return res.status(200).json({ message: 'If user exists, reset token was sent.' });
  }

  const user = await User.findOne().where('email').equals(email);

  if (!user) {
    return res.status(200).json({ message: 'If user exists, reset token was sent.' });
  }

  const resetToken = Math.random().toString(36)
    .substring(2, 10);
  const expires = new Date(Date.now() + 1000 * 60 * 30);

  user.resetToken = resetToken;
  user.resetTokenExpires = expires;
  await user.save();

  await sendResetToken({ email, token: resetToken, expires });

  res.json({ message: 'Reset token sent (if user exists).' });
}

/**
 * Completes the password reset process using a valid token.
 *
 * Validates that the token exists and has not expired. If valid, hashes the new password
 * and updates the user record. Clears the reset token fields after use.
 *
 * @route  POST /api/auth/reset-password
 * @access  Public
 * @param  req - Express request with `token` and `newPassword` in the body.
 * @param  res - Express response.
 * @returns  200 OK on success, or 400 if the token is invalid or expired.
 */
export async function resetPassword(req: Request, res: Response) {
  const token = readString(req.body?.token, 8, 256);
  const newPassword = readString(req.body?.newPassword, 6, 128);

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and newPassword are required' });
  }

  const user = await User.findOne()
    .where('resetToken')
    .equals(token)
    .where('resetTokenExpires')
    .gt(Date.now());

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.resetToken = null;
  user.resetTokenExpires = null;
  await user.save();

  res.json({ message: 'Password updated' });
}
