import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProject extends Document {
  name: string;
  slug: string;
  description?: string;
  owner: Types.ObjectId;
  createdAt: Date;
  activeVersions?: Record<string, string>;
  activeConfigRefs?: Record<string, Types.ObjectId>;
}

const ProjectSchema = new Schema<IProject>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: () => new Date() },
  activeVersions: { type: Schema.Types.Mixed, default: {} },
  activeConfigRefs: { type: Schema.Types.Mixed, default: {} },
});

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
