/**
 * User Data Sync Service
 *
 * Synchronizes user-specific localStorage data (memos, bookmarks, etc.)
 * with the server via /api/userdata endpoint (backed by Upstash Redis).
 *
 * If the server-side storage is not configured, all operations are no-ops
 * and the app falls back to localStorage-only mode.
 *
 * ## Sync strategy
 * - On login: load from server → merge with local (union, latest timestamp wins)
 * - On data change: debounced save to server (2s after last change)
 *
 * ## Data synced
 * - Market memos (sm_market_memos)
 * - System memos (sm_system_memos)
 * - Storage memos (sm_storage_memos)
 * - Item bookmarks (sm_item_bookmarks)
 * - Crafting favorites (sm_crafting_favorites)
 * - Contacts (sm_contacts)
 * - Saved loops (sm_loops)
 * - Explorer state (sm_explorer)
 */

import { marketMemoStore } from '$lib/stores/marketMemo.svelte';
import { systemMemoStore } from '$lib/stores/systemMemo.svelte';
import { storageMemoStore } from '$lib/stores/storageMemo.svelte';
import { bookmarkStore } from '$lib/stores/bookmark.svelte';
import { contactsStore } from '$lib/stores/contacts.svelte';
import { explorerStore } from '$lib/stores/explorer.svelte';
import { eventsStore } from '$lib/stores/events.svelte';
import { userKey } from '$lib/stores/storagePrefix';

export interface UserSyncData {
  marketMemos?: Record<string, unknown>;
  systemMemos?: Record<string, unknown>;
  storageMemos?: Record<string, unknown>;
  bookmarks?: string[];
  craftingFavorites?: string[];
  contacts?: { contacts: Record<string, unknown>; history: Record<string, unknown[]> };
  loops?: unknown[];
  explorer?: { homeBaseSystemId: string | null };
  savedAt?: string;
}

const SYNC_KEYS = {
  marketMemos: 'sm_market_memos',
  systemMemos: 'sm_system_memos',
  storageMemos: 'sm_storage_memos',
  bookmarks: 'sm_item_bookmarks',
  craftingFavorites: 'sm_crafting_favorites',
  contacts: 'sm_contacts',
  loops: 'sm_loops',
  explorer: 'sm_explorer',
} as const;

class UserDataSyncService {
  private username = '';
  private authToken = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private available = false;

  /** Generate a simple auth token from username and password */
  private async generateToken(username: string, password: string): Promise<string> {
    const data = new TextEncoder().encode(`${username}:${password}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Initialize sync for a user. Called after successful WebSocket login.
   * Loads server data and merges with local.
   */
  async init(username: string, password: string) {
    this.username = username;
    this.authToken = await this.generateToken(username, password);

    // Try to load from server
    try {
      const resp = await fetch(`/api/userdata?username=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` },
      });

      if (resp.status === 503) {
        // Server storage not configured – local-only mode
        this.available = false;
        return;
      }

      this.available = true;

      if (!resp.ok) return;

      const { data } = await resp.json();
      if (data) {
        this.mergeServerData(data as UserSyncData);
        eventsStore.add({ type: 'info', message: '[Sync] Cloud data loaded' });
      } else {
        // No server data yet – push local data up
        await this.pushToServer();
        eventsStore.add({ type: 'info', message: '[Sync] Local data uploaded to cloud' });
      }
    } catch (e) {
      console.warn('[UserDataSync] init failed:', e);
      this.available = false;
    }
  }

  /** Collect all syncable data from localStorage */
  private collectLocalData(): UserSyncData {
    const data: UserSyncData = { savedAt: new Date().toISOString() };
    try {
      const mm = localStorage.getItem(userKey(SYNC_KEYS.marketMemos));
      if (mm) data.marketMemos = JSON.parse(mm);
    } catch { /* ignore */ }
    try {
      const sm = localStorage.getItem(userKey(SYNC_KEYS.systemMemos));
      if (sm) data.systemMemos = JSON.parse(sm);
    } catch { /* ignore */ }
    try {
      const stm = localStorage.getItem(userKey(SYNC_KEYS.storageMemos));
      if (stm) data.storageMemos = JSON.parse(stm);
    } catch { /* ignore */ }
    try {
      const bk = localStorage.getItem(userKey(SYNC_KEYS.bookmarks));
      if (bk) data.bookmarks = JSON.parse(bk);
    } catch { /* ignore */ }
    try {
      const cf = localStorage.getItem(userKey(SYNC_KEYS.craftingFavorites));
      if (cf) data.craftingFavorites = JSON.parse(cf);
    } catch { /* ignore */ }
    try {
      const ct = localStorage.getItem(userKey(SYNC_KEYS.contacts));
      if (ct) data.contacts = JSON.parse(ct);
    } catch { /* ignore */ }
    try {
      const lp = localStorage.getItem(userKey(SYNC_KEYS.loops));
      if (lp) data.loops = JSON.parse(lp);
    } catch { /* ignore */ }
    try {
      const ex = localStorage.getItem(userKey(SYNC_KEYS.explorer));
      if (ex) data.explorer = JSON.parse(ex);
    } catch { /* ignore */ }
    return data;
  }

  /** Merge server data into local stores and localStorage */
  private mergeServerData(server: UserSyncData) {
    // Market memos: merge by station name, latest savedAt wins
    if (server.marketMemos) {
      const localRaw = localStorage.getItem(userKey(SYNC_KEYS.marketMemos));
      const local: Record<string, { savedAt?: string }> = localRaw ? JSON.parse(localRaw) : {};
      const merged = { ...local };
      for (const [key, val] of Object.entries(server.marketMemos)) {
        const sv = val as { savedAt?: string };
        const lv = local[key] as { savedAt?: string } | undefined;
        if (!lv || (sv.savedAt && (!lv.savedAt || sv.savedAt > lv.savedAt))) {
          merged[key] = sv;
        }
      }
      localStorage.setItem(userKey(SYNC_KEYS.marketMemos), JSON.stringify(merged));
      marketMemoStore.memos = merged as typeof marketMemoStore.memos;
    }

    // System memos: merge by system ID, latest savedAt wins
    if (server.systemMemos) {
      const localRaw = localStorage.getItem(userKey(SYNC_KEYS.systemMemos));
      const local: Record<string, { savedAt?: string }> = localRaw ? JSON.parse(localRaw) : {};
      const merged = { ...local };
      for (const [key, val] of Object.entries(server.systemMemos)) {
        const sv = val as { savedAt?: string };
        const lv = local[key] as { savedAt?: string } | undefined;
        if (!lv || (sv.savedAt && (!lv.savedAt || sv.savedAt > lv.savedAt))) {
          merged[key] = sv;
        }
      }
      localStorage.setItem(userKey(SYNC_KEYS.systemMemos), JSON.stringify(merged));
      systemMemoStore.memos = merged as typeof systemMemoStore.memos;
    }

    // Storage memos: merge by station name, latest savedAt wins
    if (server.storageMemos) {
      const localRaw = localStorage.getItem(userKey(SYNC_KEYS.storageMemos));
      const local: Record<string, { savedAt?: string }> = localRaw ? JSON.parse(localRaw) : {};
      const merged = { ...local };
      for (const [key, val] of Object.entries(server.storageMemos)) {
        const sv = val as { savedAt?: string };
        const lv = local[key] as { savedAt?: string } | undefined;
        if (!lv || (sv.savedAt && (!lv.savedAt || sv.savedAt > lv.savedAt))) {
          merged[key] = sv;
        }
      }
      localStorage.setItem(userKey(SYNC_KEYS.storageMemos), JSON.stringify(merged));
      storageMemoStore.memos = merged as typeof storageMemoStore.memos;
    }

    // Bookmarks: union of both sets
    if (server.bookmarks) {
      const localRaw = localStorage.getItem(userKey(SYNC_KEYS.bookmarks));
      const local: string[] = localRaw ? JSON.parse(localRaw) : [];
      const merged = [...new Set([...local, ...server.bookmarks])];
      localStorage.setItem(userKey(SYNC_KEYS.bookmarks), JSON.stringify(merged));
      bookmarkStore.ids = new Set(merged);
    }

    // Crafting favorites: union
    if (server.craftingFavorites) {
      const localRaw = localStorage.getItem(userKey(SYNC_KEYS.craftingFavorites));
      const local: string[] = localRaw ? JSON.parse(localRaw) : [];
      const merged = [...new Set([...local, ...server.craftingFavorites])];
      localStorage.setItem(userKey(SYNC_KEYS.craftingFavorites), JSON.stringify(merged));
    }

    // Contacts: server wins (more complete source)
    if (server.contacts) {
      const localRaw = localStorage.getItem(userKey(SYNC_KEYS.contacts));
      const local = localRaw ? JSON.parse(localRaw) : { contacts: {}, history: {} };
      const merged = {
        contacts: { ...local.contacts, ...server.contacts.contacts },
        history: { ...local.history, ...server.contacts.history },
      };
      localStorage.setItem(userKey(SYNC_KEYS.contacts), JSON.stringify(merged));
    }

    // Loops: merge by ID
    if (server.loops && Array.isArray(server.loops)) {
      const localRaw = localStorage.getItem(userKey(SYNC_KEYS.loops));
      const local: { id?: string }[] = localRaw ? JSON.parse(localRaw) : [];
      const localIds = new Set(local.map(l => l.id));
      const merged = [...local];
      for (const loop of server.loops) {
        const sl = loop as { id?: string };
        if (sl.id && !localIds.has(sl.id)) {
          merged.push(sl);
        }
      }
      localStorage.setItem(userKey(SYNC_KEYS.loops), JSON.stringify(merged));
    }

    // Explorer: server wins if local is empty
    if (server.explorer) {
      const localRaw = localStorage.getItem(userKey(SYNC_KEYS.explorer));
      const local = localRaw ? JSON.parse(localRaw) : null;
      if (!local?.homeBaseSystemId && server.explorer.homeBaseSystemId) {
        localStorage.setItem(userKey(SYNC_KEYS.explorer), JSON.stringify(server.explorer));
        explorerStore.homeBaseSystemId = server.explorer.homeBaseSystemId;
      }
    }
  }

  /** Push current local data to server */
  private async pushToServer() {
    if (!this.available || !this.username) return;
    const data = this.collectLocalData();
    try {
      await fetch('/api/userdata', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ username: this.username, data }),
      });
    } catch (e) {
      console.warn('[UserDataSync] push failed:', e);
    }
  }

  /**
   * Notify the sync service that data has changed.
   * Debounces to avoid excessive API calls.
   */
  notifyChange() {
    if (!this.available || !this.username) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.pushToServer();
    }, 3000);
  }

  /** Reset sync state on logout */
  reset() {
    this.username = '';
    this.authToken = '';
    this.available = false;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export const userDataSync = new UserDataSyncService();
