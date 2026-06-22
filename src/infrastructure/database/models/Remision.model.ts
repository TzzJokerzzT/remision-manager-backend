import { Schema, model, Document, Types } from 'mongoose';
import { RemisionType } from '../../../domain/entities/Remision.js';

interface RemisionItemSub {
  description: string;
  quantity: number;
  unitPrice?: number;
}

export interface RemisionDocument extends Document {
  consecutive: number;
  type: RemisionType;
  companyId: Types.ObjectId;
  clientId: Types.ObjectId;
  driverId: Types.ObjectId;
  items: RemisionItemSub[];
  subtotal?: number;
  ivaPercentage?: number;
  ivaValue?: number;
  total?: number;
  notes?: string;
  ownerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<RemisionItemSub>(
  {
    description: { type: String, required: true, trim: true, maxlength: 250 },
    quantity: { type: Number, required: true, min: 0.0001 },
    unitPrice: { type: Number, min: 0 },
  },
  { _id: false }
);

const remisionSchema = new Schema<RemisionDocument>(
  {
    consecutive: { type: Number, required: true },
    type: { type: String, enum: ['priced', 'quantity_only'], required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver', required: true },
    items: { type: [itemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    subtotal: { type: Number, min: 0 },
    ivaPercentage: { type: Number, min: 0, max: 100 },
    ivaValue: { type: Number, min: 0 },
    total: { type: Number, min: 0 },
    notes: { type: String, trim: true, maxlength: 500 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true, strict: true }
);

remisionSchema.index({ companyId: 1, consecutive: 1 }, { unique: true });

export const RemisionModel = model<RemisionDocument>('Remision', remisionSchema);
