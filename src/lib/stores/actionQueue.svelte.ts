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

/**
 * Serializable command descriptor for loop recording/playback.
 * Stored alongside the executor so loops can persist across sessions.
 */
export interface ActionCommand {
  type: string; // 'travel' | 'dock' | 'undock' | 'mine' | 'mine_full' | 'mine_n' | 'mine_pct' | 'deposit_all' | 'withdraw_all' | 'deposit_items' | 'withdraw_items' | 'jump' | ...
  params?: Record<string, unknown>;
}

export interface EnqueueOptions {
  continueOnError?: boolean;
  command?: ActionCommand;
}

class ActionQueueStore {
  items = $state<QueuedAction[]>([]);
  /** Currently executing action label (shown in ActionQueue UI). */
  currentAction = $state<string | null>(null);
  /** Whether the current executing action should not stop the queue on error. */
  currentContinueOnError = $state(false);
  /** When true, actions are queued but not executed (for loop recording). */
  recordingMode = $state(false);
  /** Tracks the last tick number for which we executed an action (avoids double-fire). */
  private lastExecutedTick = -1;
  /** Plain Map – NOT in $state – so function refs stay unproxied. */
  private executors = new Map<number, () => void>();
  /** Command descriptors for loop recording. */
  private commands = new Map<number, ActionCommand>();
  /** continueOnError flags per action. */
  private errorFlags = new Map<number, boolean>();

  enqueue(label: string, execute: () => void, opts?: EnqueueOptions) {
    const id = ++_nextId;
    this.executors.set(id, execute);
    if (opts?.command) this.commands.set(id, opts.command);
    if (opts?.continueOnError) this.errorFlags.set(id, true);
    this.items = [...this.items, { id, label }];
    eventsStore.add({ type: 'info', message: `[Queue] 追加: ${label} (${this.items.length}件)` });
    // If no action is currently executing and not in recording mode, run immediately
    if (!this.currentAction && !this.recordingMode) {
      this.executeNext();
    }
  }

  /** Insert as the next action to execute (front of queue). */
  enqueueNext(label: string, execute: () => void, opts?: EnqueueOptions) {
    const id = ++_nextId;
    this.executors.set(id, execute);
    if (opts?.command) this.commands.set(id, opts.command);
    if (opts?.continueOnError) this.errorFlags.set(id, true);
    this.items = [{ id, label }, ...this.items];
    // If no action is currently executing and not in recording mode, run immediately
    if (!this.currentAction && !this.recordingMode) {
      this.executeNext();
    }
  }

  /** Get the command descriptor for a queued action. */
  getCommand(id: number): ActionCommand | undefined {
    return this.commands.get(id);
  }

  /** Get all queued items with their command descriptors (for loop recording). */
  getRecordedCommands(): { label: string; command: ActionCommand }[] {
    return this.items
      .filter(item => this.commands.has(item.id))
      .map(item => ({ label: item.label, command: this.commands.get(item.id)! }));
  }

  remove(id: number) {
    this.executors.delete(id);
    this.commands.delete(id);
    this.errorFlags.delete(id);
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
    if (this.recordingMode) return; // Don't execute in recording mode
    if (tick >= 0 && tick === this.lastExecutedTick) return; // already ran this tick
    this.lastExecutedTick = tick;
    const [first, ...rest] = this.items;
    this.items = rest;
    const execute = this.executors.get(first.id);
    this.executors.delete(first.id);
    this.commands.delete(first.id);
    const contOnErr = this.errorFlags.get(first.id) ?? false;
    this.errorFlags.delete(first.id);
    this.currentAction = first.label;
    this.currentContinueOnError = contOnErr;
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
        this.currentContinueOnError = false;
      }
    }, 8000);
  }

  clear() {
    this.executors.clear();
    this.commands.clear();
    this.errorFlags.clear();
    this.items = [];
    this.currentAction = null;
    this.currentContinueOnError = false;
  }

  /** Clear only queued items, keep current action running. */
  clearQueue() {
    for (const item of this.items) {
      this.executors.delete(item.id);
      this.commands.delete(item.id);
      this.errorFlags.delete(item.id);
    }
    this.items = [];
  }
}

export const actionQueueStore = new ActionQueueStore();
