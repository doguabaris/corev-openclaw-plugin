/**
 * @file project.routes.ts
 * @description Defines project management routes for corev.host.
 *
 * A "project" is a named unit that groups versioned configuration files
 * under a specific user. Projects allow users to isolate and manage configurations
 * per system, app or environment (e.g., "atlas", "codex", "staging").
 *
 * These routes are only used by the hosted API (corev.host).
 * The CLI assumes that projects already exist and are referenced by name.
 *
 * Example usage in CLI:
 *   corev push configs/atlas@1.0.0.json   → requires that project "atlas" exists
 *
 * @author Doğu Abaris
 * @license MIT
 */

import { Router } from 'express';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from '../controllers/project.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { projectWriteLimiter } from '../middlewares/rate-limit.middleware';

const router = Router();

/**
 * @route   POST /api/projects
 * @desc    Creates a new project under the authenticated user's account.
 * @access  Protected
 */
router.post('/', authenticate, projectWriteLimiter, createProject);

/**
 * @route   GET /api/projects
 * @desc    Lists all projects owned by the authenticated user.
 * @access  Protected
 */
router.get('/', authenticate, listProjects);

/**
 * @route   GET /api/projects/:projectId
 * @desc    Fetch a single project by its ID.
 * @access  Protected
 */
router.get('/:projectId', authenticate, getProject);

/**
 * @route   PUT /api/projects/:projectId
 * @desc    Updates project metadata (e.g., name, description).
 * @access  Protected
 */
router.put('/:projectId', authenticate, projectWriteLimiter, updateProject);

/**
 * @route   DELETE /api/projects/:projectId
 * @desc    Deletes a project and optionally its configurations.
 * @access  Protected
 */
router.delete('/:projectId', authenticate, projectWriteLimiter, deleteProject);

export default router;
