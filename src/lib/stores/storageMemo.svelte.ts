/**
 * Storage Memo Store
 *
 * Saves snapshots of storage data per station to localStorage.
 * Only the latest snapshot per station is kept.
 * Also saves base info (facilities, services) alongside storage data.
 */

import type { CargoItem, BaseInfo, BaseServices } from '$lib/types/game';

const STORAGE_KEY = 'sm_storage_memos';

export interface StorageMemoItem {
  item_id: string;
  name?: string;
  quantity: number;
  volume?: number;
}

export interface StorageMemo {
  base: string;
  baseId: string;
  items: StorageMemoItem[];
  credits: number;
  capacity?: number;
  capacityUsed?: number;
  facilities?: string[];
  services?: string[];
  savedAt: string;
}

class StorageMemoStore {
  memos = $state<Record<string, StorageMemo>>({});

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

  get allMemos(): StorageMemo[] {
    return Object.values(this.memos);
  }

  getMemo(baseName: string): StorageMemo | null {
    return this.memos[baseName] ?? null;
  }

  save(
    baseName: string,
    baseId: string,
    items: CargoItem[],
    credits: number,
    capacity?: number,
    capacityUsed?: number,
    baseInfo?: BaseInfo | null,
  ) {
    const memoItems: StorageMemoItem[] = items.map(i => ({
      item_id: i.item_id,
      name: i.name,
      quantity: i.quantity,
      volume: i.volume,
    }));

    let facilities: string[] | undefined;
    let services: string[] | undefined;

    if (baseInfo) {
      facilities = baseInfo.facilities;
      if (baseInfo.services) {
        if (Array.isArray(baseInfo.services)) {
          services = baseInfo.services;
        } else {
          services = Object.entries(baseInfo.services as BaseServices)
            .filter(([, enabled]) => enabled)
            .map(([name]) => name);
        }
      }
    }

    const memo: StorageMemo = {
      base: baseName,
      baseId,
      items: JSON.parse(JSON.stringify(memoItems)),
      credits,
      capacity,
      capacityUsed,
      facilities,
      services,
      savedAt: new Date().toISOString(),
    };
    this.memos = { ...this.memos, [baseName]: memo };
    this.persist();
  }

  removeMemo(baseName: string) {
    const { [baseName]: _, ...rest } = this.memos;
    this.memos = rest;
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memos));
    } catch {
      // ignore storage errors
    }
  }

  reset() {
    this.memos = {};
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

export const storageMemoStore = new StorageMemoStore();
