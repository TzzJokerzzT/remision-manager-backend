export interface Client {
	id: string;
	name: string;
	documentId: string;
	address?: string;
	phone?: string;
	email?: string;
	companyId: string;
	ownerId: string;
	createdAt: Date;
	updatedAt: Date;
}
