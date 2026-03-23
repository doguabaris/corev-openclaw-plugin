/**
 * @file    app.ts
 * @description  Entry point and main application bootstrap for the Corev Host API.
 *
 * This file sets up the Express server, middleware stack, and all API route mounts.
 * It also handles database initialization and defines global error handling logic.
 *
 * Middleware stack includes:
 * - `cors`: Enables CORS for browser clients (with credentials support)
 * - `json()`: Parses incoming JSON payloads
 * - `cookieParser`: Parses cookies
 * - `express-session`: Session support for UI clients (not used by CLI)
 *
 * Mounted route groups:
 * - `/api/auth`      → Authentication and user identity routes
 * - `/api/projects`  → Project creation, update, delete
 * - `/api/configs`   → Versioned configuration operations (pull, push, checkout)
 * - `/api/logs`      → Config activity logs
 *
 * Root route `/` serves a simple HTML welcome page for human-friendly exploration.
 * All API routes require authentication except `/api/auth/*`.
 *
 * Environment variables:
 * - `SESSION_SECRET`: Used to sign session cookies
 * - `NODE_ENV`: Skips DB connection when running in test mode
 *
 * @example
 *   GET /               → returns HTML welcome
 *   GET /api/projects   → returns project list for authenticated user
 *
 * @see     config/db.ts            → MongoDB connection logic
 * @see     auth.middleware.ts      → authentication enforcement
 * @see     api/routes/*.routes.ts	→ route definitions
 * @license MIT
 * @author  Doğu Abaris
 */

import express, { json, NextFunction, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import cors from 'cors';
import { UnauthorizedError } from 'express-jwt';
import cookieParser from 'cookie-parser';
import session, { Store } from 'express-session';
import MongoStore from 'connect-mongo';
import connectDB from './config/db';

import authRoutes from './api/routes/auth.routes';
import projectRoutes from './api/routes/project.routes';
import configRoutes from './api/routes/config.routes';
import logRoutes from './api/routes/log.routes';
import { authenticate } from './api/middlewares/auth.middleware';
import { apiLimiter } from './api/middlewares/rate-limit.middleware';

dotenv.config();

const app = express();
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(48).toString('hex');

app.use(
  cors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
  }),
);

app.use(json());
app.use(cookieParser());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI!,
      collectionName: 'sessions',
    }) as unknown as Store,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/configs', authenticate, configRoutes);
app.use('/api/logs', authenticate, logRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head><title>corev.host API</title></head>
    <body>
      <h1>Welcome to Corev Host API</h1>
      <p>All endpoints are under <code>/api</code>.</p>
    </body>
    </html>
  `);
});

app.use((err: UnauthorizedError | Error, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if ('name' in err && err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  res.status(500).json({ message: 'Internal Server Error' });
});

export default app;

if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => console.warn('Database connected successfully'))
    .catch((err: unknown) => {
      if (err instanceof Error) {
        console.error('Failed to connect to the database:', err.message);
      } else {
        console.error('Unknown DB connection error:', err);
      }
      process.exit(1);
    });
}
