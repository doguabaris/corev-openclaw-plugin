/**
 * @file db.ts
 * @description Initializes MongoDB connection for the Corev Host API.
 *
 * Uses Mongoose to establish a connection to the `corev` database hosted on MongoDB Atlas.
 * This connection is required for all persistent operations across user accounts, projects,
 * configurations, logs, and tokens.
 *
 * If the connection fails, the process exits with status code 1.
 *
 * Notes:
 * - Connection string includes credentials and cluster metadata (replace in production).
 * - Should be called once during server startup (e.g., in index.ts or server.ts).
 *
 * Example usage:
 * ```ts
 * import connectDB from './db';
 * await connectDB();
 * ```
 *
 * @see https://mongoosejs.com/docs/ for Mongoose documentation
 * @see project.model.ts, config.model.ts, user.model.ts, config-log.model.ts
 * @author Doğu Abaris
 * @license MIT
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  try {
    mongoose.set('sanitizeFilter', true);
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
  } catch (err) {
    if (err instanceof Error) {
      console.error('MongoDB connection error:', err.message);
    } else {
      console.error('Unknown error during DB connection:', err);
    }
    process.exit(1);
  }
};

export default connectDB;
