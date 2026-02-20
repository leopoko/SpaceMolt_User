/**
 * System Memo Store
 *
 * Saves snapshots of system data (POIs, connections) per system to localStorage.
 * Also accumulates mining yield statistics per system/POI over time.
 *
 * ## Usage
 * ```ts
 * import { systemMemoStore } from '$lib/stores/systemMemo.svelte';
 *
 * // Save current system data
 * systemMemoStore.save(systemStore.data);
 *
 * // Get memo for a system
 * const memo = systemMemoStore.getMemo('frontier');
 *
 * // Check if memo exists
 * systemMemoStore.hasMemo('frontier'); // boolean
 *
 * // Add mining yield (called from websocket handler)
 * systemMemoStore.addMiningYield('frontier', 'frontier_belt', 'Iron Ore', 3);
 *
 * // Get mining stats for a POI
 * const stats = systemMemoStore.getMiningStats('frontier', 'frontier_belt');
 * // { totalMined: 100, items: { 'Iron Ore': 60, 'Copper Ore': 40 } }
 * ```
 */

import type { SystemInfo } from '$lib/types/game';
import { userDataSync } from '$lib/services/userDataSync';

const STORAGE_KEY = 'sm_system_memos';

export interface MemoPOI {
  id: string;
  name: string;
  type: string;
  position?: { x: number; y: number };
}

export interface MemoConnection {
  system_id: string;
  system_name: string;
  security_level?: string | null;
  jump_cost?: number | null;
  distance?: number | null;
}

export interface PoiMiningStats {
  totalMined: number;
  items: Record<string, number>; // item name/id -> total quantity
}

export interface SystemMemo {
  systemId: string;
  systemName: string;
  securityLevel: string;
  description?: string;
  pois: MemoPOI[];
  connections: MemoConnection[];
  miningStats: Record<string, PoiMiningStats>; // poiId -> stats
  savedAt: string;
}

class SystemMemoStore {
  memos = $state<Record<string, SystemMemo>>({});

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          this.memos = JSON.parse(saved);
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  get allMemos(): SystemMemo[] {
    return Object.values(this.memos);
  }

  getMemo(systemId: string): SystemMemo | null {
    return this.memos[systemId] ?? null;
  }

  hasMemo(systemId: string): boolean {
    return systemId in this.memos;
  }

  /** Save/update system info in memo. Preserves existing mining stats. */
  save(systemData: SystemInfo | null) {
    if (!systemData?.id) return;

    const existing = this.memos[systemData.id];

    const memo: SystemMemo = {
      systemId: systemData.id,
      systemName: systemData.name,
      securityLevel: String(systemData.security_level ?? 'null'),
      description: systemData.description,
      pois: (systemData.pois ?? []).map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        ...(p.position ? { position: { x: p.position.x, y: p.position.y } } : {}),
      })),
      connections: (systemData.connections ?? []).map(c => ({
        system_id: c.system_id,
        system_name: c.system_name,
        security_level: c.security_level,
        jump_cost: c.jump_cost,
        distance: c.distance,
      })),
      // Preserve accumulated mining stats
      miningStats: existing?.miningStats ?? {},
      savedAt: new Date().toISOString(),
    };

    this.memos = { ...this.memos, [systemData.id]: memo };
    this.persist();
  }

  /** Add a mining yield to the stats for a system/POI. */
  addMiningYield(systemId: string, poiId: string, item: string, quantity: number) {
    if (!systemId || !poiId || !item || quantity <= 0) return;

    const memo = this.memos[systemId];
    if (!memo) return; // No memo for this system yet; need to save system first

    const stats = memo.miningStats[poiId] ?? { totalMined: 0, items: {} };
    stats.totalMined += quantity;
    stats.items[item] = (stats.items[item] ?? 0) + quantity;
    memo.miningStats[poiId] = stats;

    // Trigger reactivity
    this.memos = { ...this.memos };
    this.persist();
  }

  /** Get mining stats for a specific POI. */
  getMiningStats(systemId: string, poiId: string): PoiMiningStats | null {
    const memo = this.memos[systemId];
    if (!memo) return null;
    return memo.miningStats[poiId] ?? null;
  }

  /** Get all mining stats for a system (all POIs). */
  getSystemMiningStats(systemId: string): Record<string, PoiMiningStats> {
    return this.memos[systemId]?.miningStats ?? {};
  }

  /** Remove memo for a system. */
  removeMemo(systemId: string) {
    const { [systemId]: _, ...rest } = this.memos;
    this.memos = rest;
    this.persist();
  }

  /** Clear mining stats for a specific system/POI. */
  clearMiningStats(systemId: string, poiId?: string) {
    const memo = this.memos[systemId];
    if (!memo) return;
    if (poiId) {
      delete memo.miningStats[poiId];
    } else {
      memo.miningStats = {};
    }
    this.memos = { ...this.memos };
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memos));
    } catch {
      // ignore storage errors
    }
    userDataSync.notifyChange();
  }

  reset() {
    this.memos = {};
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

export const systemMemoStore = new SystemMemoStore();
