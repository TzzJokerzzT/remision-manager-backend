export interface Driver {
	id: string;
	name: string;
	documentId: string;
	licenseNumber?: string;
	phone?: string;
	vehiclePlate?: string;
	companyId: string;
	ownerId: string;
	createdAt: Date;
	updatedAt: Date;
}
