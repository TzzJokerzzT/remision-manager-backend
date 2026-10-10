export type RemisionType = "priced" | "quantity_only";
export type DocumentType = "remision" | "orden_compra" | "cotizacion";

export interface RemisionItem {
	description: string;
	quantity: number;
	unitPrice?: number;
	hasIva?: boolean;
	ivaPercentage?: number;
	ivaValue?: number;
}

export interface Remision {
	id: string;
	consecutive: number;
	type: RemisionType;
	documentType: DocumentType;
	companyId: string;
	clientId: string;
	driverId?: string;
	items: RemisionItem[];
	subtotal?: number;
	ivaValue?: number;
	hasRetencion: boolean;
	retencionPercentage?: number;
	retencionValue?: number;
	total?: number;
	notes?: string;
	ownerId: string;
	createdAt: Date;
	updatedAt: Date;
}
