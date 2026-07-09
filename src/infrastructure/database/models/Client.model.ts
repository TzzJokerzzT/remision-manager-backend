import { type Document, model, Schema, type Types } from "mongoose";

export interface ClientDocument extends Document {
	name: string;
	documentId: string;
	address?: string;
	phone?: string;
	email?: string;
	companyId: Types.ObjectId;
	ownerId: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const clientSchema = new Schema<ClientDocument>(
	{
		name: { type: String, required: true, trim: true, maxlength: 150 },
		documentId: { type: String, required: true, trim: true, maxlength: 30 },
		address: { type: String, trim: true, maxlength: 250 },
		phone: { type: String, trim: true, maxlength: 30 },
		email: { type: String, trim: true, lowercase: true, maxlength: 200 },
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

clientSchema.index({ name: "text", documentId: "text" });

export const ClientModel = model<ClientDocument>("Client", clientSchema);
