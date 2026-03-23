/**
 * @file config.routes.ts
 * @description Defines the API routes for handling versioned configuration files
 * as specified in the Corev CLI contract. These routes are used by commands such as
 * `corev pull`, `corev push`, and `corev checkout` to interact with the remote server.
 *
 * All configuration files are expected to follow the naming convention:
 *   <project>@<version>.json
 *
 * The payload format for configs is:
 * {
 *   "name": "project-name",
 *   "version": "x.y.z",
 *   "config": { ... } // arbitrary JSON content
 * }
 *
 * Each route aligns with CLI behavior as defined in:
 * - pull.ts              → `GET /configs/:project/latest`
 * - checkout.ts          → `GET /configs/:project/:version`
 * - push.ts / revert.ts  → `POST /configs/:project`
 *
 * These endpoints are called by the CLI after loading `.corevrc.json` for API + token.
 *
 * Example:
 *   corev push configs/atlas@1.0.0.json
 *   corev pull atlas
 *   corev checkout atlas 1.0.0
 *
 * @author Doğu Abaris
 * @license MIT
 */

import { Router } from 'express';
import {
  deleteConfig,
  getAllConfigs,
  getLatestConfig,
  getSpecificConfig,
  updateConfig,
  uploadConfig,
} from '../controllers/config.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { configSchema } from '../../schemas/config.schema';

const router = Router();

/**
 * @route   POST /api/configs/:project
 * @desc    Uploads a new or updated configuration for the specified project.
 *          The request body must include "name", "version", and "config".
 * @access  Protected
 * @example corev push configs/atlas@1.0.0.json
 */
router.post('/:project', authenticate, validateBody(configSchema), uploadConfig);

/**
 * @route   GET /api/configs/:project/latest
 * @desc    Fetches the latest configuration version for the given project.
 * @access  Protected
 * @example corev pull atlas
 */
router.get('/:project/latest', authenticate, getLatestConfig);

/**
 * @route   GET /api/configs/:project/all
 * @desc    Lists all configuration versions for a given project.
 * @access  Protected
 * @note    Used by the Corev Host UI (not CLI)
 */
router.get('/:project/all', authenticate, getAllConfigs);

/**
 * @route   GET /api/configs/:project/:version
 * @desc    Fetches a specific configuration version for a given project.
 * @access  Protected
 * @example corev checkout atlas 1.0.0
 */
router.get('/:project/:version', authenticate, getSpecificConfig);

/**
 * @route   PUT /api/configs/:project/:version
 * @desc    Updates a specific configuration version’s content.
 * @access  Protected
 */
router.put('/:project/:version', authenticate, updateConfig);

/**
 * @route   DELETE /api/configs/:project/:version
 * @desc    Deletes a specific configuration version under a project.
 * @access  Protected
 */
router.delete('/:project/:version', authenticate, deleteConfig);

export default router;
