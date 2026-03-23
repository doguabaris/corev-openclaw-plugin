/**
 * @file auth.routes.ts
 * @description Defines authentication and user identity management routes
 * for the Corev Host API. These endpoints allow users to register, log in,
 * recover access, and manage their own account information.
 *
 * All protected routes use Bearer token authentication via Authorization headers.
 * Tokens are stored in `.corevrc.json` by the CLI or in browser cookies by UI clients.
 *
 * Example CLI usage:
 *   corev init --api https://api.corev.dev --token <your_token>
 *
 * Core route structure:
 * - /signup            → create account
 * - /login             → authenticate user
 * - /forgot-password   → request reset token
 * - /reset-password    → submit new password
 * - /whoami            → check current session token
 * - /me (PUT, DELETE)  → self-management
 *
 * @author Doğu Abaris
 * @license MIT
 */

import { Router } from 'express';
import {
  deleteSelf,
  forgotPassword,
  login,
  resetPassword,
  signup,
  updateSelf,
  whoami,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rate-limit.middleware';

const router = Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Registers a new user account with email and password.
 * @access  Public
 */
router.post('/signup', authLimiter, signup);

/**
 * @route   POST /api/auth/login
 * @desc    Logs in a user and returns a token (JWT or static).
 * @access  Public
 */
router.post('/login', authLimiter, login);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiates password reset process by generating a reset token.
 * @access  Public
 */
router.post('/forgot-password', authLimiter, forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Resets user password using a valid token.
 * @access  Public
 */
router.post('/reset-password', authLimiter, resetPassword);

/**
 * @route   GET /api/auth/whoami
 * @desc    Returns the currently authenticated user (via token).
 * @access  Protected
 */
router.get('/whoami', authenticate, whoami);

/**
 * @route   PUT /api/auth/me
 * @desc    Updates current user’s email or password.
 * @access  Protected
 */
router.put('/me', authenticate, updateSelf);

/**
 * @route   DELETE /api/auth/me
 * @desc    Deletes current user account and associated resources.
 * @access  Protected
 */
router.delete('/me', authenticate, deleteSelf);

export default router;
