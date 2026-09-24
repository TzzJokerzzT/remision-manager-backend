import { ValidationError } from "../../shared/errors/AppError.js";
import type { RemisionItem } from "../entities/Remision.js";

export interface RemisionTotals {
	subtotal: number | undefined;
	ivaValue: number | undefined;
	retencionValue: number | undefined;
	total: number | undefined;
}

export function computeRemisionTotals(
	items: RemisionItem[],
	type: "priced" | "quantity_only",
	ivaPercentage?: number,
	hasRetencion = false,
	retencionPercentage?: number,
): RemisionTotals {
	if (type === "quantity_only") {
		return {
			subtotal: undefined,
			ivaValue: undefined,
			retencionValue: undefined,
			total: undefined,
		};
	}

	for (const item of items) {
		if (item.unitPrice !== undefined && item.unitPrice < 0) {
			throw new ValidationError("unitPrice no puede ser negativo");
		}
	}

	const subtotal = items.reduce(
		(acc, i) => acc + i.quantity * (i.unitPrice ?? 0),
		0,
	);
	const iva = ivaPercentage ?? 0;
	const ivaValue = +(subtotal * (iva / 100)).toFixed(2);

	let retencionValue: number | undefined;
	if (hasRetencion && retencionPercentage !== undefined) {
		retencionValue = +(subtotal * (retencionPercentage / 100)).toFixed(2);
	}

	const total = +(subtotal + ivaValue - (retencionValue ?? 0)).toFixed(2);
	return { subtotal: +subtotal.toFixed(2), ivaValue, retencionValue, total };
}
