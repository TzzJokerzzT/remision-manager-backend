import { ValidationError } from "../../shared/errors/AppError.js";
import type { RemisionItem } from "../entities/Remision.js";

export interface RemisionTotals {
	subtotal: number | undefined;
	ivaValue: number | undefined;
	retencionValue: number | undefined;
	total: number | undefined;
	items: RemisionItem[];
}

function round2(value: number): number {
	return Number(value.toFixed(2));
}

export function computeRemisionTotals(
	items: RemisionItem[],
	type: "priced" | "quantity_only",
	hasRetencion = false,
	retencionPercentage?: number,
): RemisionTotals {
	if (type === "quantity_only") {
		return {
			subtotal: undefined,
			ivaValue: undefined,
			retencionValue: undefined,
			total: undefined,
			// A derived per-item value must never survive here: quantity_only
			// produces no IVA at all. hasIva/ivaPercentage are kept so a later
			// switch to "priced" can reuse the rates.
			items: items.map(({ ivaValue: _ivaValue, ...rest }) => rest),
		};
	}

	for (const item of items) {
		if (item.unitPrice !== undefined && item.unitPrice < 0) {
			throw new ValidationError("unitPrice no puede ser negativo");
		}
		if (item.hasIva === undefined) {
			throw new ValidationError(
				"Cada item debe incluir hasIva; reenvíe los items con IVA por item",
			);
		}
		if (
			item.hasIva === true &&
			(item.ivaPercentage === undefined || item.ivaPercentage <= 0)
		) {
			throw new ValidationError(
				"ivaPercentage es requerido y debe ser mayor a 0 cuando hasIva es true",
			);
		}
	}

	const subtotal = items.reduce(
		(acc, i) => acc + i.quantity * (i.unitPrice ?? 0),
		0,
	);

	let ivaValue = 0;
	const enrichedItems = items.map((item) => {
		if (item.hasIva === true) {
			const rate = item.ivaPercentage ?? 0;
			const perItemIva = round2(
				item.quantity * (item.unitPrice ?? 0) * (rate / 100),
			);
			ivaValue += perItemIva;
			return { ...item, ivaValue: perItemIva };
		}
		const { ivaValue: _ivaValue, ...rest } = item;
		return rest;
	});

	ivaValue = round2(ivaValue);

	let retencionValue: number | undefined;
	if (hasRetencion && retencionPercentage !== undefined) {
		retencionValue = round2(subtotal * (retencionPercentage / 100));
	}

	const total = round2(subtotal + ivaValue - (retencionValue ?? 0));
	return {
		subtotal: round2(subtotal),
		ivaValue,
		retencionValue,
		total,
		items: enrichedItems,
	};
}
