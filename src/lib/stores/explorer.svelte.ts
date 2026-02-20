/**
 * Explorer Store
 *
 * Tracks the home base system ID for the galaxy map center.
 * Only one home base system at a time. Persisted to localStorage.
 *
 * When a new home base POI is detected in a visited system,
 * the previous home base is cleared and the new one is set.
 */

import { prefixKey } from './storagePrefix';

const STORAGE_KEY = 'sm_explorer';

class ExplorerStore {
  homeBaseSystemId = $state<string | null>(null);

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(prefixKey(STORAGE_KEY));
        if (saved) {
          const data = JSON.parse(saved);
          this.homeBaseSystemId = data.homeBaseSystemId ?? null;
        }
      } catch { /* ignore */ }
    }
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
      localStorage.setItem(prefixKey(STORAGE_KEY), JSON.stringify({
        homeBaseSystemId: this.homeBaseSystemId,
      }));
    } catch { /* ignore */ }
  }

  reset() {
    this.homeBaseSystemId = null;
    try { localStorage.removeItem(prefixKey(STORAGE_KEY)); } catch { /* ignore */ }
  }
}

export const explorerStore = new ExplorerStore();
