/**
 * @file config.controller.ts
 * @description Handles versioned configuration file logic for the Corev Host API.
 *
 * This module implements the backend behavior for configuration-related routes used
 * by the Corev CLI. It includes upload, fetch, update, list, and delete operations.
 *
 * All configurations follow the expected payload structure:
 * {
 *   "name": "project-name",
 *   "version": "x.y.z",
 *   "config": { ... } // arbitrary key-value pairs
 * }
 *
 * Endpoint mappings to CLI commands:
 * - `corev push` / `corev revert` → POST /api/configs/:project
 * - `corev pull` → GET /api/configs/:project/latest
 * - `corev checkout` → GET /api/configs/:project/:version
 *
 * Token authentication is required for all operations and is typically provided by the CLI
 * via `.corevrc.json` or by the browser for the UI client.
 *
 * Internal side effects include:
 * - Logging configuration actions (`pull`, `push`, `revert`) via `logChange()`
 * - Maintaining the latest version reference in the associated `Project` document
 *
 * @example
 *   corev push configs/atlas@1.0.0.json
 *   corev pull codex
 *   corev checkout atlas 1.2.1
 *
 * @author      Doğu Abaris
 * @license     MIT
 * @see         config.routes.ts for route definitions
 * @see         README.md for Corev usage and contract
 */

import { Response } from 'express';
import { Project } from '../../models/project.model';
import { Config } from '../../models/config.model';
import { AuthenticatedRequest } from '@interfaces/authenticated-request.interface';
import { logChange } from '../../services/log.service';

/**
 * Uploads a new configuration version or reuses an existing one for a project.
 *
 * If the version already exists, it will be reused and marked as the latest.
 * Otherwise, a new `Config` document is created. Also updates the `Project` metadata
 * and logs the action (push or revert).
 *
 * @route  POST /api/configs/:project
 * @access  Protected
 * @param  req - Authenticated request containing `name`, `version`, `config` in body.
 * @param  res - Express response with saved config or error.
 * @returns  200 if config reused, 201 if created, or 404 if project not found.
 */
export async function uploadConfig(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  const { project } = req.params;
  const { name, version, config } = req.body;
  const env = req.headers['x-corev-env']?.toString() || 'production';

  const projectDoc = await Project.findOne({ slug: project, owner: userId });
  if (!projectDoc) {
    return res.status(404).json({ status: 'error', message: 'Project not found' });
  }

  const action = req.headers['x-corev-action'] === 'revert' ? 'revert' : 'push';

  let cfg = await Config.findOne({
    project: projectDoc._id,
    name,
    version,
    env,
  });

  if (cfg) {
    await Project.updateOne(
      { _id: projectDoc._id },
      {
        $set: {
          [`activeVersions.${env}`]: version,
          [`activeConfigRefs.${env}`]: cfg._id,
        },
      },
    );

    await logChange({
      projectId: projectDoc._id,
      version,
      action,
      actor: userId,
      valid: true,
      env,
    });
    return res.json(cfg);
  }

  cfg = new Config({
    name,
    version,
    config,
    project: projectDoc._id,
    env,
  });

  await cfg.save();

  await Project.updateOne(
    { _id: projectDoc._id },
    {
      $set: {
        [`activeVersions.${env}`]: version,
        [`activeConfigRefs.${env}`]: cfg._id,
      },
    },
  );

  await logChange({ projectId: projectDoc._id, version, action, actor: userId, valid: true, env });

  return res.status(201).json(cfg);
}

/**
 * Retrieves the latest configuration version for a given project.
 *
 * If the `latestConfig` reference exists, it is returned.
 * Otherwise, it falls back to the most recently created config document.
 * Logs a `pull` action if a config is successfully returned.
 *
 * @route  GET /api/configs/:project/latest
 * @access  Protected
 * @param  req - Authenticated request.
 * @param  res - Express response with latest config or error.
 * @returns  200 OK with config, or 404 if project or configs are missing.
 */
export async function getLatestConfig(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  const { project } = req.params;
  const env = req.headers['x-corev-env']?.toString() || 'production';

  const projectDoc = await Project.findOne({ slug: project, owner: userId });
  if (!projectDoc) {
    return res.status(404).json({ status: 'error', message: 'Project not found' });
  }

  const latest = await Config.find({ project: projectDoc._id, env })
    .sort({ createdAt: -1 })
    .limit(1)
    .lean();

  if (!latest.length) {
    return res.status(404).json({ status: 'error', message: `No configs found for env: ${env}` });
  }

  await logChange({
    projectId: projectDoc._id,
    version: latest[0].version,
    action: 'pull',
    actor: userId,
    valid: true,
    env,
  });
  return res.json(latest[0]);
}

/**
 * Returns all configuration versions for a project, sorted by creation date descending.
 *
 * This route is used primarily by the Corev Host UI for displaying a full version history.
 * CLI does not consume this endpoint.
 *
 * @route  GET /api/configs/:project/all
 * @access  Protected
 * @param  req - Authenticated request with `project` slug param.
 * @param  res - Express response with config array or error.
 * @returns  200 OK with config list, or 404 if project is not found.
 */
export async function getAllConfigs(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  const projectSlug = req.params.project;
  const env = req.headers['x-corev-env']?.toString() || 'production';

  const project = await Project.findOne({ slug: projectSlug, owner: userId });
  if (!project) {
    return res.status(404).json({ error: 'Project not found or not owned by you' });
  }

  const configs = await Config.find({ project: project._id, env }).sort({ createdAt: -1 });

  return res.json(configs);
}

/**
 * Updates the `config` content of an existing versioned configuration.
 *
 * This does not change the version string or metadata—only the internal config JSON.
 *
 * @route  PUT /api/configs/:project/:version
 * @access  Protected
 * @param  req - Authenticated request with new `config` object in the body.
 * @param  res - Express response with updated config or error.
 * @returns  200 OK on success, 400 or 404 on invalid input or missing records.
 */
export async function updateConfig(req: AuthenticatedRequest, res: Response) {
  const { project, version } = req.params;
  const { config } = req.body;
  const env = req.headers['x-corev-env']?.toString() || 'production';
  const userId = req.auth?.id;

  if (!config || typeof config !== 'object') {
    return res.status(400).json({ error: 'Valid JSON config is required.' });
  }

  const projectDoc = await Project.findOne({ slug: project, owner: userId });
  if (!projectDoc) {
    return res.status(404).json({ error: 'Project not found or not owned by you' });
  }

  const existing = await Config.findOne({
    project: projectDoc._id,
    version,
    env,
  });

  if (!existing) {
    return res.status(404).json({ error: `Config not found for env: ${env}` });
  }

  existing.config = config;
  await existing.save();

  return res.json({ message: 'Config updated', config: existing });
}

/**
 * Deletes a specific configuration version under the given project.
 *
 * Does not affect the project or other versions. Deletion is irreversible.
 *
 * @route  DELETE /api/configs/:project/:version
 * @access  Protected
 * @param  req - Authenticated request with project slug and version.
 * @param  res - Express response confirming deletion.
 * @returns  200 OK on success, or 404 if config not found.
 */
export async function deleteConfig(req: AuthenticatedRequest, res: Response) {
  const { project, version } = req.params;
  const env = req.headers['x-corev-env']?.toString() || 'production';
  const userId = req.auth?.id;

  const projectDoc = await Project.findOne({ slug: project, owner: userId });
  if (!projectDoc) {
    return res.status(404).json({ error: 'Project not found or not owned by you' });
  }

  const deleted = await Config.findOneAndDelete({
    project: projectDoc._id,
    version,
    env,
  });

  if (!deleted) {
    return res.status(404).json({ error: `Config version not found for env: ${env}` });
  }

  return res.json({ message: 'Config deleted', version, env });
}

/**
 * Fetches a specific version of a configuration under a given project.
 *
 * This is used by `corev checkout` to retrieve historical versions.
 *
 * @route  GET /api/configs/:project/:version
 * @access  Protected
 * @param  req - Authenticated request with project and version.
 * @param  res - Express response with a config or error.
 * @returns  200 OK with config, or 404 if not found.
 */
export async function getSpecificConfig(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  const { project, version } = req.params;
  const env = req.headers['x-corev-env']?.toString() || 'production';

  const projectDoc = await Project.findOne({ slug: project, owner: userId });
  if (!projectDoc) {
    return res.status(404).json({ status: 'error', message: 'Project not found' });
  }

  const configDoc = await Config.findOne({
    project: projectDoc._id,
    version,
    env,
  }).lean();

  if (!configDoc) {
    return res.status(404).json({
      status: 'error',
      message: `Config version not found for env: ${env}`,
    });
  }

  return res.json(configDoc);
}
