import mongoose, { Document, Schema, Types } from 'mongoose';

export type ConfigAction = 'push' | 'revert' | 'checkout' | 'pull';

export interface IConfigLog extends Document {
  project: Types.ObjectId;
  version: string;
  actor?: string;
  action: ConfigAction;
  timestamp: Date;
  valid?: boolean;
  diffSummary?: string[];
  env: string;
}

const ConfigLogSchema = new Schema<IConfigLog>({
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  version: { type: String, required: true },
  actor: { type: String },
  action: { type: String, enum: ['push', 'revert', 'checkout', 'pull'], required: true },
  timestamp: { type: Date, default: () => new Date() },
  valid: { type: Boolean },
  diffSummary: [{ type: String }],
  env: { type: String, default: 'production' },
});

export const ConfigLog = mongoose.model<IConfigLog>('ConfigLog', ConfigLogSchema, 'config_logs');
