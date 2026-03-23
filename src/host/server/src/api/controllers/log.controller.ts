/**
 * @file log.controller.ts
 * @description Handles retrieval of configuration change logs for Corev projects.
 *
 * This controller provides access to audit trail data associated with configuration actions,
 * such as `pull`, `push`, `revert`, and other versioned updates made through the Corev CLI.
 *
 * Endpoint mapping:
 *   corev-host UI → GET /api/logs/:projectId
 *
 * All logs are retrieved for the specified project (by ID) and are limited to the most
 * recent 100 entries, sorted by timestamp in descending order.
 *
 * Authentication is required. Only the project owner can access logs for a project.
 *
 * Each log entry corresponds to a previously recorded configuration change via `logChange()`.
 * These entries are stored in the `ConfigLog` collection.
 *
 * @example
 *   GET /api/logs/65c7bcd2af2e1c9f8b0a23e4
 *
 * @returns JSON array of log entries:
 * ```json
 * [
 *   {
 *     "_id": "logId123",
 *     "project": "projectId",
 *     "version": "1.0.0",
 *     "action": "push",
 *     "actor": "userId",
 *     "valid": true,
 *     "timestamp": "2025-06-28T15:12:34.000Z"
 *   },
 *   ...
 * ]
 * ```
 *
 * @see         config-log.model.ts for the log schema
 * @see         log.service.ts for logging logic used by CLI-triggered actions
 * @author      Doğu Abaris
 * @license     MIT
 */

import { Response } from 'express';
import { ConfigLog } from '../../models/config-log.model';
import { AuthenticatedRequest } from '@interfaces/authenticated-request.interface';
import { Project } from '../../models/project.model';

/**
 * Retrieves the 100 most recent configuration change logs for a given project.
 *
 * This endpoint is used by the Corev Host UI to visualize audit history and recent
 * activity for a project. Only the project owner may access its logs. Logs include
 * version info, action type, timestamp, and validity.
 *
 * The project is identified by MongoDB `_id`, not slug. If the project is not found
 * or is not owned by the requesting user, the request is rejected.
 *
 * @route  GET /api/logs/:projectId
 * @access  Protected
 * @param  req - Authenticated request with `auth.id` and `projectId` route parameter.
 * @param  res - Express response returning an array of `ConfigLog` entries.
 * @returns  200 OK with logs, or 404 if the project is not found or unauthorized.
 *
 * @example
 *   GET /api/logs/65c7bcd2af2e1c9f8b0a23e4
 *   → [
 *        {
 *          "_id": "log123",
 *          "version": "1.0.0",
 *          "action": "push",
 *          "timestamp": "2025-06-28T15:12:34.000Z",
 *          "valid": true,
 *          "actor": "userId"
 *        },
 *        ...
 *     ]
 */
export async function getProjectLogs(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  const { projectId } = req.params;

  const projectDoc = await Project.findOne({ _id: projectId, owner: userId });
  if (!projectDoc) {
    return res.status(404).json({ error: 'Project not found or unauthorized' });
  }

  const logs = await ConfigLog.find({ project: projectDoc._id }).sort({ timestamp: -1 })
    .limit(100);

  return res.json(logs);
}
