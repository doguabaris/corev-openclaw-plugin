/**
 * @file log.routes.ts
 * @description Defines configuration log routes for the Corev Host API.
 *
 * This route module exposes endpoints for retrieving audit trails related to
 * versioned configuration actions (e.g., push, pull, revert). It allows users
 * to see recent activity for their projects.
 *
 * This functionality is used primarily by the Corev Host web UI for inspection,
 * debugging, or audit purposes. The CLI does not directly call this endpoint.
 *
 * Example:
 *   GET /api/logs/<projectId> → returns recent change logs (latest 100)
 *
 * All routes are protected and require valid authentication (token or secret).
 *
 * @see log.controller.ts → request handler for getProjectLogs
 * @see config-log.model.ts → schema used for storing logs
 * @see log.service.ts → utility used by CLI-triggered actions to log changes
 * @author Doğu Abaris
 * @license MIT
 */

import { Router } from 'express';
import { getProjectLogs } from '../controllers/log.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @route GET /api/logs/:project
 * @desc  Returns recent config change logs for a project
 * @access Protected
 */
router.get('/:projectId', authenticate, getProjectLogs);

export default router;
