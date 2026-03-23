import mongoose, { Document, Schema } from 'mongoose';
import { randomBytes } from 'crypto';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  apiSecret: string;
  createdAt: Date;
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  apiSecret: {
    type: String,
    required: true,
    unique: true,
    default: () => randomBytes(12).toString('hex'),
  },
  createdAt: { type: Date, default: () => new Date() },
  resetToken: { type: String, default: null },
  resetTokenExpires: { type: Date, default: null },
});

export const User = mongoose.model<IUser>('User', UserSchema);
