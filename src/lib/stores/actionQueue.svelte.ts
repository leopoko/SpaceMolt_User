import { eventsStore } from '$lib/stores/events.svelte';

let _nextId = 0;

export interface QueuedAction {
  id: number;
  label: string;
  execute: () => void;
}

class ActionQueueStore {
  items = $state<QueuedAction[]>([]);
  /** Tracks the last tick number for which we executed an action (avoids double-fire). */
  private lastExecutedTick = -1;

  enqueue(label: string, execute: () => void) {
    this.items = [...this.items, { id: ++_nextId, label, execute }];
    eventsStore.add({ type: 'info', message: `[Queue] 追加: ${label} (${this.items.length}件)` });
  }

  remove(id: number) {
    this.items = this.items.filter(a => a.id !== id);
  }

  moveUp(id: number) {
    const idx = this.items.findIndex(a => a.id === id);
    if (idx > 0) {
      const arr = [...this.items];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      this.items = arr;
    }
  }

  moveDown(id: number) {
    const idx = this.items.findIndex(a => a.id === id);
    if (idx >= 0 && idx < this.items.length - 1) {
      const arr = [...this.items];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      this.items = arr;
    }
  }

  /**
   * Called on each tick – execute and remove the first queued action.
   * Pass the current tick number to prevent double-execution when both
   * `tick` and `state_update` events fire for the same tick.
   */
  executeNext(tick = -1) {
    if (this.items.length === 0) return;
    if (tick >= 0 && tick === this.lastExecutedTick) return; // already ran this tick
    this.lastExecutedTick = tick;
    const [first, ...rest] = this.items;
    this.items = rest;
    eventsStore.add({ type: 'info', message: `[Queue] 実行: ${first.label}` });
    try {
      first.execute();
    } catch (e) {
      console.error('[ActionQueue] execute failed:', e);
      eventsStore.add({ type: 'error', message: `[Queue] エラー: ${first.label}` });
    }
  }

  clear() {
    this.items = [];
  }
}

export const actionQueueStore = new ActionQueueStore();
