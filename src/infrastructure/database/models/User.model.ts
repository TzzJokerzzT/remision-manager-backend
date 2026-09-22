import { type Document, model, Schema } from "mongoose";
import type { UserRole } from "../../../domain/entities/User.js";

export interface UserDocument extends Document {
	name: string;
	email: string;
	passwordHash: string;
	role: UserRole;
	companyLogoUrl?: string | null;
	isActive: boolean;
	refreshTokenHash?: string | null; // hash del último refresh token válido (rotación)
	createdAt: Date;
	updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
	{
		name: { type: String, required: true, trim: true, maxlength: 120 },
		email: {
			type: String,
			required: true,
			unique: true,
			trim: true,
			lowercase: true,
			maxlength: 200,
			match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email inválido"],
		},
		passwordHash: { type: String, required: true, select: false },
		role: { type: String, enum: ["admin", "user"], default: "user" },
		companyLogoUrl: { type: String, default: null },
		isActive: { type: Boolean, default: true },
		refreshTokenHash: { type: String, default: null, select: false },
	},
	{ timestamps: true, strict: true },
);

export const UserModel = model<UserDocument>("User", userSchema);
