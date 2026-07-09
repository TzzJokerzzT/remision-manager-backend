export interface Company {
	id: string;
	name: string;
	nit: string;
	address?: string;
	phone?: string;
	email?: string;
	logoUrl?: string | null;
	ownerId: string;
	createdAt: Date;
	updatedAt: Date;
}
