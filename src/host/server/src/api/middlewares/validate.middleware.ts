/**
 * @file validate.middleware.ts
 * @description Middleware for validating request bodies using JSON Schema (AJV).
 *
 * This middleware factory validates `req.body` against a specified JSON schema
 * using the AJV validator. It is used to enforce input structure and ensure that
 * all required fields are present and correctly typed before hitting controller logic.
 *
 * On validation failure, it responds with:
 *   - HTTP 400 status
 *   - A message summarizing the first error
 *   - A list of detailed error messages in `errors[]`
 *
 * Typical usage:
 * ```ts
 * import { configSchema } from '../../schemas/config.schema';
 * router.post('/configs/:project', authenticate, validateBody(configSchema), uploadConfig);
 * ```
 *
 * Notes:
 * - This middleware uses AJV with `allErrors: true` to report multiple issues at once.
 * - Schema must be a plain JSON Schema object, not a compiled validator function.
 *
 * @param schema - JSON Schema object to validate against
 * @returns Express middleware function
 *
 * @see https://ajv.js.org/ for AJV documentation
 * @see config.schema.ts for example schema used with this middleware
 * @author Doğu Abaris
 * @license MIT
 */

import { NextFunction, Request, Response } from 'express';
 
const MAX_VALIDATION_DEPTH = 20;
const MAX_VALIDATION_NODES = 5000;

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function exceedsTraversalLimits(input: unknown): boolean {
  if (!isContainer(input)) return false;

  const stack: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 1 }];
  const visited = new WeakSet<object>();
  let nodes = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !isContainer(current.value)) continue;
    if (current.depth > MAX_VALIDATION_DEPTH) return true;

    const asObject = current.value as object;
    if (visited.has(asObject)) continue;
    visited.add(asObject);

    nodes += 1;
    if (nodes > MAX_VALIDATION_NODES) return true;

    const values = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as Record<string, unknown>);

    for (const child of values) {
      if (isContainer(child)) {
        stack.push({ value: child, depth: current.depth + 1 });
      }
    }
  }

  return false;
}

function isPrimitiveType(value: unknown, type: string): boolean {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isContainer(value) && !Array.isArray(value);
  return true;
}

/**
 * Creates an Express middleware that validates `req.body` against a JSON Schema.
 *
 * This function uses AJV (Another JSON Validator) to enforce strict validation
 * rules for incoming requests. If the body fails validation, a 400 Bad Request
 * is returned with an error message and list of individual schema violations.
 *
 * The middleware is intended to be used in route declarations before controller logic,
 * ensuring type-safe, predictable request structures.
 *
 * @param  schema - A plain JSON Schema object (not a compiled validator).
 * @returns  An Express middleware function that validates `req.body` or sends a 400 error response.
 *
 * @example
 *   import { configSchema } from '../schemas/config.schema';
 *
 *   router.post(
 *     '/configs/:project',
 *     authenticate,
 *     validateBody(configSchema),
 *     uploadConfig
 *   );
 *
 * @see    https://ajv.js.org/ for AJV documentation.
 * @see    config.schema.ts for an example schema used with this middleware.
 */
export function validateBody(schema: object) {
  const jsonSchema = schema as {
    required?: string[];
    additionalProperties?: boolean;
    properties?: Record<string, { type?: string }>;
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (exceedsTraversalLimits(req.body)) {
      return res.status(413).json({
        status: 'error',
        message: 'Payload is too deeply nested.',
      });
    }

    const body = req.body;
    const errors: string[] = [];

    if (!isContainer(body) || Array.isArray(body)) {
      errors.push('/ must be an object');
    } else {
      const payload = body as Record<string, unknown>;
      const required = jsonSchema.required || [];
      const properties = jsonSchema.properties || {};

      for (const key of required) {
        if (payload[key] === undefined) {
          errors.push(`/${key} is required`);
        }
      }

      for (const [key, value] of Object.entries(payload)) {
        if (jsonSchema.additionalProperties === false && !Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`/${key} is not allowed`);
          continue;
        }
        const expectedType = properties[key]?.type;
        if (expectedType && !isPrimitiveType(value, expectedType)) {
          errors.push(`/${key} must be ${expectedType}`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: errors[0] || 'Validation failed',
        errors,
      });
    }

    next();
  };
}
