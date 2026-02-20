/**
 * localStorage key prefix for multi-instance support.
 *
 * When running multiple dev servers on different ports (e.g. localhost:5173, localhost:5174),
 * each instance gets its own localStorage namespace so credentials and memos don't collide.
 *
 * - Port 5173 (default): no prefix (backward-compatible with existing data)
 * - Port 5174+: prefix "p{port}_" (e.g. "p5174_spacemolt_username")
 */

function getPrefix(): string {
	if (typeof window === 'undefined') return '';
	const port = window.location.port;
	if (!port || port === '5173') return '';
	return `p${port}_`;
}

const PREFIX = getPrefix();

/** Add instance-specific prefix to a localStorage key. */
export function prefixKey(key: string): string {
	return PREFIX + key;
}
