/**
 * @file config.schema.ts
 * @description Defines the JSON Schema for validating Corev configuration objects.
 *
 * This schema enforces the structure of versioned configuration files managed
 * through the Corev CLI and Host API. It ensures all configuration payloads
 * include the required metadata and an arbitrary JSON-based config object.
 *
 * Expected structure:
 * ```json
 * {
 *   "name": "atlas",
 *   "version": "1.0.0",
 *   "config": {
 *     "key": "value",
 *     ...
 *   }
 * }
 * ```
 *
 * Schema rules:
 * - `name`: string (project slug or identifier)
 * - `version`: string (semantic version, timestamp, or tag)
 * - `config`: object with unrestricted keys/values
 * - No additional top-level properties allowed
 *
 * This schema is compiled and used in the `validateBody()` middleware.
 *
 * @example
 *   corev push configs/atlas@1.0.0.json
 *   → Validated against this schema before persistence
 *
 * @see validate.middleware.ts for how this schema is enforced
 * @see Configuration type in types.ts for the matching TypeScript type
 * @see https://json-schema.org/ for schema documentation and validation standards
 * @license MIT
 * @author Doğu Abaris
 */

export const configSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
    },
    version: {
      type: 'string',
    },
    config: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['name', 'version', 'config'],
  additionalProperties: false,
} as const;
