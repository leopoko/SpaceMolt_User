/**
 * localStorage key prefix for multi-instance and multi-user support.
 *
 * ## Port-based prefix (multi-instance)
 * When running multiple dev servers on different ports (e.g. localhost:5173, localhost:5174),
 * each instance gets its own localStorage namespace.
 * - Port 5173 (default): no prefix (backward-compatible)
 * - Port 5174+: prefix "p{port}_"
 *
 * ## User-based prefix (multi-user)
 * User-specific data (memos, bookmarks, contacts, etc.) is prefixed with "u:{username}:"
 * so switching accounts on the same client doesn't leak data between users.
 *
 * Usage:
 * - `prefixKey(key)` — for shared/device-level data (auth credentials, UI settings)
 * - `userKey(key)` — for user-specific data (memos, bookmarks, contacts, loops, etc.)
 */

function getPortPrefix(): string {
	if (typeof window === 'undefined') return '';
	const port = window.location.port;
	if (!port || port === '5173') return '';
	return `p${port}_`;
}

const PORT_PREFIX = getPortPrefix();

/** The currently logged-in username. Empty string if not logged in. */
let currentUsername = '';

/**
 * Set the current username for user-scoped localStorage keys.
 * Called on login. Pass empty string on logout.
 */
export function setCurrentUser(username: string) {
	currentUsername = username;
}

/** Get the current username (for migration/debugging). */
export function getCurrentUser(): string {
	return currentUsername;
}

/** Add instance-specific prefix to a localStorage key (shared across users). */
export function prefixKey(key: string): string {
	return PORT_PREFIX + key;
}

/**
 * Add user-specific prefix to a localStorage key.
 * Format: "{portPrefix}u:{username}:{key}"
 *
 * If no user is set, falls back to the non-user-scoped key (backward-compatible).
 */
export function userKey(key: string): string {
	if (!currentUsername) return PORT_PREFIX + key;
	return PORT_PREFIX + `u:${currentUsername}:` + key;
}

/**
 * Migrate data from the old non-user-scoped key to the new user-scoped key.
 * Only migrates if the user-scoped key doesn't already exist and the old key does.
 * Called once per store on first login with user scoping.
 */
export function migrateToUserKey(key: string): void {
	if (typeof localStorage === 'undefined' || !currentUsername) return;
	const oldKey = PORT_PREFIX + key;
	const newKey = userKey(key);
	if (oldKey === newKey) return; // no migration needed (no user set)
	// Only migrate if new key doesn't exist and old key does
	if (localStorage.getItem(newKey) === null && localStorage.getItem(oldKey) !== null) {
		const data = localStorage.getItem(oldKey);
		if (data) {
			localStorage.setItem(newKey, data);
		}
	}
}
