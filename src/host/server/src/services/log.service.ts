/**
 * @file log.service.ts
 * @description Provides logging utility for recording configuration actions.
 *
 * This service is used by the Corev Host API to persist audit trails whenever
 * a configuration file is pushed, pulled, reverted, or checked out via the CLI
 * or UI. Each log entry is saved to the `ConfigLog` collection.
 *
 * Log entries include:
 * - `project`: Reference to the associated Project
 * - `version`: The configuration version involved
 * - `action`: The type of operation performed ("push", "pull", etc.)
 * - `actor`: Optional user ID of the person who performed the action
 * - `timestamp`: ISO datetime when the action occurred
 * - `valid`: Indicates whether the config was valid at the time of action
 * - `diffSummary`: Optional array of string-based diff summaries
 *
 * This utility is typically invoked from controllers after config operations complete.
 *
 * @example
 * ```ts
 * await logChange({
 *   projectId: project._id,
 *   version: '1.0.0',
 *   action: 'push',
 *   actor: userId,
 *   valid: true,
 * });
 * ```
 *
 * @see       config-log.model.ts → Mongoose schema for logged entries
 * @see       config.controller.ts → calls logChange() after each operation
 * @license   MIT
 * @author    Doğu Abaris
 */

import { Types } from 'mongoose';
import { ConfigAction, ConfigLog } from '../models/config-log.model';

export async function logChange({
  projectId,
  version,
  action,
  actor,
  valid = true,
  diffSummary = [],
  env = 'production',
}: {
  projectId: Types.ObjectId;
  version: string;
  action: ConfigAction;
  actor?: string;
  valid: boolean;
  diffSummary?: string[];
  env?: string;
}) {
  await ConfigLog.create({
    project: projectId,
    version,
    action,
    actor,
    timestamp: new Date(),
    valid,
    diffSummary,
    env,
  });
}
