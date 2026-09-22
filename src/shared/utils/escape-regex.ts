/**
 * Escapes regex metacharacters so user input is treated as a literal
 * substring in a `new RegExp(...)` / Mongo `$regex` expression. Mitigates
 * regex-injection and catastrophic-backtracking ReDoS on name search.
 */
export function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
