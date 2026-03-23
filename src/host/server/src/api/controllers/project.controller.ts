/**
 * @file project.controller.ts
 * @description Implements project management logic for corev.host.
 *
 * A project is a named entity that serves as a namespace for storing versioned configuration
 * files. Each project is owned by a user and identified by a unique `slug` derived from its name.
 *
 * These controller functions are used exclusively by the hosted API (corev.host) and are not
 * called by the Corev CLI directly. Instead, the CLI expects project slugs to already exist.
 *
 * Supported operations:
 *   - createProject: Creates a new project under the authenticated user.
 *   - listProjects: Lists all projects owned by the user.
 *   - getProject: Retrieves a specific project by its slug (not ObjectId).
 *   - updateProject: Updates name and/or description of a project.
 *   - deleteProject: Deletes a project (config deletion TBD).
 *
 * Project metadata includes name, slug, description, owner, and timestamps.
 * Slugs are automatically generated using `slugify()` and used in CLI commands like:
 *   corev push configs/<slug>@<version>.json
 *
 * @example
 *   POST /api/projects             → create "atlas"
 *   GET  /api/projects             → list owned projects
 *   GET  /api/projects/atlas       → get project metadata
 *   PUT  /api/projects/atlas       → update project
 *   DELETE /api/projects/atlas     → delete project
 *
 * @see project.routes.ts for route bindings
 * @see Project model (project.model.ts) for schema
 * @author Doğu Abaris
 * @license MIT
 */

import { Response } from 'express';
import { Project } from '../../models/project.model';
import { Config } from '../../models/config.model';
import { ConfigLog } from '../../models/config-log.model';
import slugify from 'slugify';
import { AuthenticatedRequest } from '@interfaces/authenticated-request.interface';
import { Types } from 'mongoose';

/**
 * Creates a new project for the authenticated user.
 *
 * Generates a slug from the provided name using `slugify()`. Prevents duplicate project
 * slugs for the same user. Stores metadata including name, description, and owner ID.
 *
 * @route  POST /api/projects
 * @access  Protected
 * @param  req - Authenticated request with `name` and optional `description` in the body.
 * @param  res - Express response with created project or error message.
 * @returns  201 Created on success, 400 or 409 on validation or duplication error.
 */
export async function createProject(req: AuthenticatedRequest, res: Response) {
  const { name, description } = req.body;
  const userId = req.auth?.id;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Project name is required and must be a string.' });
  }

  const slug = slugify(name, { lower: true, strict: true });

  const existing = await Project.findOne({ slug, owner: userId });
  if (existing) {
    return res.status(409).json({ error: 'You already have a project with this name.' });
  }

  const project = new Project({ name, slug, description, owner: userId });
  await project.save();

  res.status(201).json({ message: 'Project created', project });
}

/**
 * Lists all projects owned by the authenticated user.
 *
 * Results are sorted by creation time in descending order. Used by the UI to
 * render the user’s dashboard of projects. CLI does not invoke this endpoint.
 *
 * @route  GET /api/projects
 * @access  Protected
 * @param  req - Authenticated request.
 * @param  res - Express response containing an array of project objects.
 * @returns  200 OK with project list.
 */
export async function listProjects(req: AuthenticatedRequest, res: Response) {
  const userId = req.auth?.id;
  const projects = await Project.aggregate([
    { $match: { owner: new Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'configs',
        localField: '_id',
        foreignField: 'project',
        as: 'configs',
      },
    },
    {
      $project: {
        name: 1,
        slug: 1,
        description: 1,
        createdAt: 1,
        activeVersion: 1,
        configCount: { $size: '$configs' },
        envCount: {
          $cond: [
            { $isArray: { $objectToArray: '$activeVersions' } },
            { $size: { $objectToArray: '$activeVersions' } },
            0,
          ],
        },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
  res.json(projects);
}

/**
 * Retrieves a specific project by a slug, scoped to the current user.
 *
 * Used by the Corev Host UI for project detail views and metadata display.
 *
 * @route  GET /api/projects/:projectId
 * @access  Protected
 * @param  req - Authenticated request with project slug in `params.projectId`.
 * @param  res - Express response with the project object or error.
 * @returns  200 OK with project, or 404 if not found or not owned by user.
 */
export async function getProject(req: AuthenticatedRequest, res: Response) {
  const { projectId } = req.params;
  const userId = req.auth?.id;

  const project = await Project.findOne({ slug: projectId, owner: userId });
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json(project);
}

/**
 * Updates the name and/or description of a project.
 *
 * If the name changes, the project slug is also regenerated. Only the owner can update a project.
 * All updates are saved atomically in a single operation.
 *
 * @route  PUT /api/projects/:projectId
 * @access  Protected
 * @param  req - Authenticated request with updated fields in the body.
 * @param  res - Express response with updated project data or error.
 * @returns  200 OK on success, or 404 if project is not found.
 */
export async function updateProject(req: AuthenticatedRequest, res: Response) {
  const { projectId } = req.params;
  const { name, description } = req.body;
  const userId = req.auth?.id;

  const project = await Project.findOne({ _id: projectId, owner: userId });
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (name) {
    project.name = name;
    project.slug = slugify(name, { lower: true, strict: true });
  }

  if (description !== undefined) {
    project.description = description;
  }

  await project.save();
  res.json({ message: 'Project updated', project });
}

/**
 * Permanently deletes a project owned by the user.
 *
 * Also deletes all associated configuration versions and change logs.
 * This prevents orphaned config data and ensures audit trails are fully cleared.
 *
 * @route  DELETE /api/projects/:projectId
 * @access  Protected
 * @param  req - Authenticated request with project ID in the route parameter.
 * @param  res - Express response with deletion confirmation or error.
 * @returns  200 OK on success, or 404 if the project does not exist or is not owned.
 */
export async function deleteProject(req: AuthenticatedRequest, res: Response) {
  const { projectId } = req.params;
  const userId = req.auth?.id;

  const project = await Project.findOne({ _id: projectId, owner: userId }).lean();

  if (!project) {
    return res.status(404).json({ error: 'Project not found or already deleted.' });
  }

  await Project.deleteOne({ _id: projectId });

  await Config.deleteMany({ project: project._id });
  await ConfigLog.deleteMany({ project: project._id });

  res.json({ message: 'Project and all associated data deleted.' });
}
