import { type Document, model, Schema, type Types } from "mongoose";

export interface CounterDocument extends Document {
	companyId: Types.ObjectId;
	seq: number;
}

const counterSchema = new Schema<CounterDocument>(
	{
		companyId: {
			type: Schema.Types.ObjectId,
			ref: "Company",
			required: true,
			unique: true,
			index: true,
		},
		seq: { type: Number, required: true, default: 0 },
	},
	{ timestamps: false },
);

export const CounterModel = model<CounterDocument>("Counter", counterSchema);
