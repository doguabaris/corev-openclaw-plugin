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
import Ajv, { ErrorObject } from 'ajv';

const ajv = new Ajv({ allErrors: true });

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
  const validate = ajv.compile(schema);

  return (req: Request, res: Response, next: NextFunction) => {
    const valid = validate(req.body);

    if (!valid) {
      const errors = (validate.errors || []).map((err: ErrorObject) => {
        const path = 'instancePath' in err ? err.instancePath : err.dataPath || '';
        return `${path} ${err.message}`;
      });

      return res.status(400).json({
        status: 'error',
        message: errors[0] || 'Validation failed',
        errors,
      });
    }

    next();
  };
}
