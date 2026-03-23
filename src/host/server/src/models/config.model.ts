import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IConfig extends Document {
  name: string;
  version: string;
  config: Record<string, unknown>;
  project: Types.ObjectId;
  env?: string;
  createdAt: Date;
}

const ConfigSchema = new Schema<IConfig>({
  name: { type: String, required: true },
  version: { type: String, required: true },
  config: { type: Schema.Types.Mixed, required: true },
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  env: { type: String, default: 'production' },
  createdAt: { type: Date, default: () => new Date() },
});

ConfigSchema.index({ name: 1, version: 1, project: 1, env: 1 }, { unique: true });

export const Config = mongoose.model<IConfig>('Config', ConfigSchema);
