/**
 * @file server.ts
 * @description  Launches the Corev Host API server.
 *
 * This file starts the Express application defined in `app.ts` and listens
 * on the port defined by the `PORT` environment variable or defaults to 5000.
 *
 * It is the entry point for production and development environments, and should
 * be used as the primary script when starting the backend server.
 *
 * Example:
 *   NODE_ENV=production PORT=3000 node dist/server.js
 *
 * @see        app.ts  → Express app configuration and route setup
 * @license    MIT
 * @author     Doğu Abaris
 */

import app from './app';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.warn(`Server running on port ${PORT}`));
