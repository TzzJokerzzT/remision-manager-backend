import { type Document, model, Schema, type Types } from "mongoose";

export interface DriverDocument extends Document {
	name: string;
	documentId: string;
	licenseNumber?: string;
	phone?: string;
	vehiclePlate?: string;
	companyId: Types.ObjectId;
	ownerId: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const driverSchema = new Schema<DriverDocument>(
	{
		name: { type: String, required: true, trim: true, maxlength: 150 },
		documentId: { type: String, required: true, trim: true, maxlength: 30 },
		licenseNumber: { type: String, trim: true, maxlength: 30 },
		phone: { type: String, trim: true, maxlength: 30 },
		vehiclePlate: { type: String, trim: true, maxlength: 15, uppercase: true },
		companyId: {
			type: Schema.Types.ObjectId,
			ref: "Company",
			required: true,
			index: true,
		},
		ownerId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
	},
	{ timestamps: true, strict: true },
);

driverSchema.index({ name: "text", documentId: "text", vehiclePlate: "text" });

export const DriverModel = model<DriverDocument>("Driver", driverSchema);
