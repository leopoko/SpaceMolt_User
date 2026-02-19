import { eventsStore } from '$lib/stores/events.svelte';

let _nextId = 0;

/**
 * Only serializable fields live in $state to avoid the Svelte 5
 * state_proxy_equality_mismatch warning that arises when functions
 * are stored inside a $state-proxied object.
 * The actual execute callbacks are kept in a plain Map outside of $state.
 */
export interface QueuedAction {
  id: number;
  label: string;
}

class ActionQueueStore {
  items = $state<QueuedAction[]>([]);
  /** Currently executing action label (shown in ActionQueue UI). */
  currentAction = $state<string | null>(null);
  /** Tracks the last tick number for which we executed an action (avoids double-fire). */
  private lastExecutedTick = -1;
  /** Plain Map – NOT in $state – so function refs stay unproxied. */
  private executors = new Map<number, () => void>();

  enqueue(label: string, execute: () => void) {
    const id = ++_nextId;
    this.executors.set(id, execute);
    this.items = [...this.items, { id, label }];
    eventsStore.add({ type: 'info', message: `[Queue] 追加: ${label} (${this.items.length}件)` });
    // If no action is currently executing, run immediately without waiting for next tick
    if (!this.currentAction) {
      this.executeNext();
    }
  }

  remove(id: number) {
    this.executors.delete(id);
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
    const execute = this.executors.get(first.id);
    this.executors.delete(first.id);
    this.currentAction = first.label;
    eventsStore.add({ type: 'info', message: `[Queue] 実行: ${first.label}` });
    try {
      execute?.();
    } catch (e) {
      console.error('[ActionQueue] execute failed:', e);
      eventsStore.add({ type: 'error', message: `[Queue] エラー: ${first.label}` });
    }
    // Clear current action after a short delay to allow UI to show it
    setTimeout(() => {
      if (this.currentAction === first.label) {
        this.currentAction = null;
      }
    }, 8000);
  }

  clear() {
    this.executors.clear();
    this.items = [];
    this.currentAction = null;
  }
}

export const actionQueueStore = new ActionQueueStore();
