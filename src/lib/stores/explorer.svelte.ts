/**
 * Explorer Store
 *
 * Tracks the home base system ID for the galaxy map center.
 * Only one home base system at a time. Persisted to localStorage.
 *
 * When a new home base POI is detected in a visited system,
 * the previous home base is cleared and the new one is set.
 */

import { userKey, migrateToUserKey } from './storagePrefix';

const STORAGE_KEY = 'sm_explorer';

class ExplorerStore {
  homeBaseSystemId = $state<string | null>(null);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(userKey(STORAGE_KEY));
        if (saved) {
          const data = JSON.parse(saved);
          this.homeBaseSystemId = data.homeBaseSystemId ?? null;
        }
      } catch { /* ignore */ }
    }
  }

  /** Reload from localStorage after user switch. Migrates old data if needed. */
  reload() {
    migrateToUserKey(STORAGE_KEY);
    this.loadFromStorage();
  }

  /** Set the home base system. Clears any previous home base. */
  setHomeBase(systemId: string) {
    this.homeBaseSystemId = systemId;
    this.persist();
  }

  clearHomeBase() {
    this.homeBaseSystemId = null;
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(userKey(STORAGE_KEY), JSON.stringify({
        homeBaseSystemId: this.homeBaseSystemId,
      }));
    } catch { /* ignore */ }
  }

  reset() {
    this.homeBaseSystemId = null;
    try { localStorage.removeItem(userKey(STORAGE_KEY)); } catch { /* ignore */ }
  }
}

export const explorerStore = new ExplorerStore();
