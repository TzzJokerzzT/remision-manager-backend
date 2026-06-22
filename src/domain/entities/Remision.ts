export type RemisionType = 'priced' | 'quantity_only';

export interface RemisionItem {
  description: string;
  quantity: number;
  unitPrice?: number;
}

export interface Remision {
  id: string;
  consecutive: number;
  type: RemisionType;
  companyId: string;
  clientId: string;
  driverId: string;
  items: RemisionItem[];
  subtotal?: number;
  ivaPercentage?: number;
  ivaValue?: number;
  total?: number;
  notes?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}
