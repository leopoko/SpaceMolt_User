/**
 * Market Memo Store
 *
 * Saves snapshots of market data per station to localStorage.
 * Only the latest snapshot per station is kept.
 *
 * ## Usage from other components
 *
 * ```ts
 * import { marketMemoStore } from '$lib/stores/marketMemo.svelte';
 *
 * // Get memo for a specific station
 * const memo = marketMemoStore.getMemo('Frontier Station');
 * if (memo) {
 *   console.log(memo.base);       // "Frontier Station"
 *   console.log(memo.items);      // MarketItem[] – full item list with buy/sell orders
 *   console.log(memo.savedAt);    // ISO timestamp of when the memo was saved
 * }
 *
 * // Get all saved memos
 * const allMemos = marketMemoStore.allMemos; // MarketMemo[]
 *
 * // Look up best_sell / best_buy for a specific item across all memos
 * const info = marketMemoStore.getItemPrice('ore_iron');
 * // { item_name: "Iron Ore", best_buy: 3, best_sell: 8, station: "Frontier Station", savedAt: "..." }
 * ```
 *
 * ## Data structure
 *
 * Each memo contains:
 * - `base: string` – station name (key)
 * - `items: MarketItem[]` – the full items array from view_market
 * - `savedAt: string` – ISO 8601 timestamp
 *
 * MarketItem has:
 * - `item_id`, `item_name`, `best_buy`, `best_sell`, `spread?`
 * - `buy_orders: { price_each, quantity, source? }[]`
 * - `sell_orders: { price_each, quantity, source? }[]`
 */

import type { MarketData, MarketItem } from '$lib/types/game';

const STORAGE_KEY = 'sm_market_memos';

export interface MarketMemo {
  base: string;
  items: MarketItem[];
  savedAt: string;
}

export interface ItemPriceInfo {
  item_id: string;
  item_name: string;
  best_buy: number;
  best_sell: number;
  station: string;
  savedAt: string;
}

class MarketMemoStore {
  memos = $state<Record<string, MarketMemo>>({});

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

  /** All saved memos as an array */
  get allMemos(): MarketMemo[] {
    return Object.values(this.memos);
  }

  /** Get memo for a specific station (by base name) */
  getMemo(baseName: string): MarketMemo | null {
    return this.memos[baseName] ?? null;
  }

  /** Save current market data as a memo (overwrites previous for same station) */
  save(marketData: MarketData) {
    if (!marketData.base || !marketData.items) return;
    const memo: MarketMemo = {
      base: marketData.base,
      items: JSON.parse(JSON.stringify(marketData.items)), // deep clone to avoid proxy issues
      savedAt: new Date().toISOString(),
    };
    this.memos = { ...this.memos, [marketData.base]: memo };
    this.persist();
  }

  /** Remove memo for a station */
  removeMemo(baseName: string) {
    const { [baseName]: _, ...rest } = this.memos;
    this.memos = rest;
    this.persist();
  }

  /** Look up the best price info for an item across all memos */
  getItemPrice(itemId: string): ItemPriceInfo | null {
    for (const memo of this.allMemos) {
      const item = memo.items.find(i => i.item_id === itemId);
      if (item) {
        return {
          item_id: item.item_id,
          item_name: item.item_name,
          best_buy: item.best_buy,
          best_sell: item.best_sell,
          station: memo.base,
          savedAt: memo.savedAt,
        };
      }
    }
    return null;
  }

  /** Get all items across all memos (latest per item_id) */
  getAllItemPrices(): ItemPriceInfo[] {
    const seen = new Map<string, ItemPriceInfo>();
    // Process newest memos first
    const sorted = [...this.allMemos].sort((a, b) =>
      new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
    for (const memo of sorted) {
      for (const item of memo.items) {
        if (!seen.has(item.item_id)) {
          seen.set(item.item_id, {
            item_id: item.item_id,
            item_name: item.item_name,
            best_buy: item.best_buy,
            best_sell: item.best_sell,
            station: memo.base,
            savedAt: memo.savedAt,
          });
        }
      }
    }
    return Array.from(seen.values());
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

export const marketMemoStore = new MarketMemoStore();
