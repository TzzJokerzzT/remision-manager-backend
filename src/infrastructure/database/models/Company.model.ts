import { Schema, model, Document, Types } from 'mongoose';

export interface CompanyDocument extends Document {
  name: string;
  nit: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string | null;
  ownerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<CompanyDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    nit: { type: String, required: true, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 250 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    logoUrl: { type: String, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true, strict: true }
);

companySchema.index({ ownerId: 1, nit: 1 }, { unique: true });
companySchema.index({ name: 'text', nit: 'text' });

export const CompanyModel = model<CompanyDocument>('Company', companySchema);
