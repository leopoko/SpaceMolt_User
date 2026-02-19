import type { ActionCommand } from '$lib/stores/actionQueue.svelte';
import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
import { eventsStore } from '$lib/stores/events.svelte';
import { ws } from '$lib/services/websocket';
import { shipStore } from '$lib/stores/ship.svelte';
import { baseStore } from '$lib/stores/base.svelte';

const STORAGE_KEY = 'sm_loops';

/** A single step in a saved loop. */
export interface LoopStep {
  label: string;
  command: ActionCommand;
}

/** A saved loop tied to a specific station. */
export interface SavedLoop {
  id: string;
  stationId: string;
  stationName: string;
  name: string;
  steps: LoopStep[];
  createdAt: string;
}

class LoopStore {
  /** Whether we are currently recording a loop. */
  isRecording = $state(false);
  /** The station where recording started. */
  recordingStationId = $state<string | null>(null);
  recordingStationName = $state<string | null>(null);

  /** All saved loops (loaded from localStorage). */
  savedLoops = $state<SavedLoop[]>([]);

  /** Currently playing loop info. */
  isPlaying = $state(false);
  playingLoopId = $state<string | null>(null);
  currentIteration = $state(0);
  totalIterations = $state(0); // 0 = infinite

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.savedLoops = JSON.parse(raw) as SavedLoop[];
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.savedLoops));
    } catch {
      // ignore
    }
  }

  /** Start recording at the current station. */
  startRecording(stationId: string, stationName: string) {
    this.isRecording = true;
    this.recordingStationId = stationId;
    this.recordingStationName = stationName;
    actionQueueStore.recordingMode = true;
    // Clear any existing queue
    actionQueueStore.clearQueue();
    eventsStore.add({ type: 'info', message: `[Loop] 録画開始 @ ${stationName}` });
  }

  /** Cancel recording without saving. */
  cancelRecording() {
    this.isRecording = false;
    this.recordingStationId = null;
    this.recordingStationName = null;
    actionQueueStore.recordingMode = false;
    actionQueueStore.clearQueue();
    eventsStore.add({ type: 'info', message: '[Loop] 録画キャンセル' });
  }

  /** Save the recorded actions as a loop. */
  saveRecording(name?: string) {
    const commands = actionQueueStore.getRecordedCommands();
    if (commands.length === 0) {
      eventsStore.add({ type: 'error', message: '[Loop] 記録されたアクションがありません' });
      return;
    }

    const loop: SavedLoop = {
      id: `loop_${Date.now()}`,
      stationId: this.recordingStationId ?? '',
      stationName: this.recordingStationName ?? '',
      name: name || `Loop @ ${this.recordingStationName ?? 'Unknown'}`,
      steps: commands.map(c => ({ label: c.label, command: c.command })),
      createdAt: new Date().toISOString(),
    };

    // Replace existing loop for same station if same name, otherwise add
    const idx = this.savedLoops.findIndex(l => l.stationId === loop.stationId && l.name === loop.name);
    if (idx >= 0) {
      this.savedLoops = [...this.savedLoops.slice(0, idx), loop, ...this.savedLoops.slice(idx + 1)];
    } else {
      this.savedLoops = [...this.savedLoops, loop];
    }

    this.saveToStorage();

    // Stop recording
    this.isRecording = false;
    this.recordingStationId = null;
    this.recordingStationName = null;
    actionQueueStore.recordingMode = false;
    actionQueueStore.clearQueue();

    eventsStore.add({ type: 'info', message: `[Loop] 保存: ${loop.name} (${loop.steps.length}ステップ)` });
  }

  /** Delete a saved loop. */
  deleteLoop(loopId: string) {
    this.savedLoops = this.savedLoops.filter(l => l.id !== loopId);
    this.saveToStorage();
  }

  /** Rename a saved loop. */
  renameLoop(loopId: string, newName: string) {
    this.savedLoops = this.savedLoops.map(l =>
      l.id === loopId ? { ...l, name: newName } : l
    );
    this.saveToStorage();
  }

  /** Get loops for a specific station. */
  getLoopsForStation(stationId: string): SavedLoop[] {
    return this.savedLoops.filter(l => l.stationId === stationId);
  }

  /** Play a saved loop. iterations=0 means infinite. */
  playLoop(loopId: string, iterations: number) {
    const loop = this.savedLoops.find(l => l.id === loopId);
    if (!loop || loop.steps.length === 0) return;

    this.isPlaying = true;
    this.playingLoopId = loopId;
    this.currentIteration = 1;
    this.totalIterations = iterations;

    eventsStore.add({
      type: 'info',
      message: `[Loop] 再生開始: ${loop.name} (${iterations === 0 ? '∞' : iterations}回)`
    });

    this.enqueueLoopSteps(loop);
  }

  /** Stop the currently playing loop after current actions complete. */
  stopLoop() {
    this.isPlaying = false;
    this.playingLoopId = null;
    this.currentIteration = 0;
    this.totalIterations = 0;
    // Clear remaining queue items
    actionQueueStore.clearQueue();
    eventsStore.add({ type: 'info', message: '[Loop] 再生停止' });
  }

  /** Called when the last action in a loop iteration completes (from the sentinel callback). */
  onIterationComplete() {
    if (!this.isPlaying || !this.playingLoopId) return;

    const loop = this.savedLoops.find(l => l.id === this.playingLoopId);
    if (!loop) {
      this.stopLoop();
      return;
    }

    // Check if more iterations needed
    if (this.totalIterations > 0 && this.currentIteration >= this.totalIterations) {
      eventsStore.add({ type: 'info', message: `[Loop] 完了: ${loop.name} (${this.totalIterations}回)` });
      this.isPlaying = false;
      this.playingLoopId = null;
      this.currentIteration = 0;
      this.totalIterations = 0;
      return;
    }

    // Start next iteration
    this.currentIteration++;
    eventsStore.add({
      type: 'info',
      message: `[Loop] イテレーション ${this.currentIteration}/${this.totalIterations === 0 ? '∞' : this.totalIterations}`
    });
    this.enqueueLoopSteps(loop);
  }

  /** Enqueue all steps of a loop, plus a sentinel to trigger the next iteration. */
  private enqueueLoopSteps(loop: SavedLoop) {
    for (const step of loop.steps) {
      const { label, execute, opts } = this.replayCommand(step);
      actionQueueStore.enqueue(label, execute, opts);
    }

    // Add sentinel action at the end to trigger next iteration
    actionQueueStore.enqueue(`[Loop] ${loop.name} — 完了`, () => {
      this.onIterationComplete();
    }, { command: { type: '_loop_sentinel' } });
  }

  /** Convert a LoopStep into an executable action. */
  private replayCommand(step: LoopStep): { label: string; execute: () => void; opts?: { continueOnError?: boolean; command?: ActionCommand } } {
    const cmd = step.command;
    const opts = { command: cmd, continueOnError: false };

    switch (cmd.type) {
      case 'travel':
        return {
          label: step.label,
          execute: () => ws.travel(cmd.params!.poiId as string),
          opts,
        };

      case 'dock':
        return {
          label: step.label,
          execute: () => ws.dock(cmd.params!.stationId as string),
          opts,
        };

      case 'undock':
        return {
          label: step.label,
          execute: () => ws.undock(),
          opts,
        };

      case 'jump':
        return {
          label: step.label,
          execute: () => ws.jump(cmd.params!.systemId as string, cmd.params?.systemName as string | undefined),
          opts,
        };

      case 'mine':
        return {
          label: step.label,
          execute: () => ws.mine(cmd.params?.asteroidId as string | undefined),
          opts,
        };

      case 'mine_full': {
        // Iterative mine-until-full using enqueueNext pattern
        const targetPct = 100;
        const asteroidId = cmd.params?.asteroidId as string | undefined;
        const doConditionalMine = () => {
          if (shipStore.cargoPercent >= targetPct) {
            eventsStore.add({ type: 'info', message: `[Mining] Cargo ${shipStore.cargoPercent.toFixed(0)}% – 停止` });
            return;
          }
          ws.mine(asteroidId);
          actionQueueStore.enqueueNext(step.label, doConditionalMine, { command: cmd });
        };
        return { label: step.label, execute: doConditionalMine, opts };
      }

      case 'mine_n': {
        const count = (cmd.params?.count as number) ?? 1;
        const current = (cmd.params?.current as number) ?? 1;
        const asteroidId = cmd.params?.asteroidId as string | undefined;
        return {
          label: `Mine [${current}/${count}]`,
          execute: () => ws.mine(asteroidId),
          opts,
        };
      }

      case 'mine_pct': {
        const targetPct = (cmd.params?.targetPct as number) ?? 80;
        const asteroidId = cmd.params?.asteroidId as string | undefined;
        const doConditionalMine = () => {
          if (shipStore.cargoPercent >= targetPct) {
            eventsStore.add({ type: 'info', message: `[Mining] Cargo ${shipStore.cargoPercent.toFixed(0)}% – 停止` });
            return;
          }
          ws.mine(asteroidId);
          actionQueueStore.enqueueNext(step.label, doConditionalMine, { command: cmd });
        };
        return { label: step.label, execute: doConditionalMine, opts };
      }

      case 'deposit_all': {
        const contOpts = { ...opts, continueOnError: true };
        const doIterativeDeposit = () => {
          const cargoItems = shipStore.cargo.filter(c => c.quantity > 0);
          if (cargoItems.length === 0) {
            eventsStore.add({ type: 'info', message: '[Base] Deposit All 完了' });
            return;
          }
          const first = cargoItems[0];
          ws.depositItems(first.item_id, first.quantity);
          actionQueueStore.enqueueNext('Deposit All', doIterativeDeposit, contOpts);
        };
        return { label: step.label, execute: doIterativeDeposit, opts: contOpts };
      }

      case 'withdraw_all': {
        const contOpts = { ...opts, continueOnError: true };
        const doIterativeWithdraw = () => {
          const storageItems = baseStore.items.filter(i => i.quantity > 0);
          if (storageItems.length === 0) {
            eventsStore.add({ type: 'info', message: '[Base] Withdraw All 完了' });
            return;
          }
          const first = storageItems[0];
          ws.withdrawItems(first.item_id, first.quantity);
          actionQueueStore.enqueueNext('Withdraw All', doIterativeWithdraw, contOpts);
        };
        return { label: step.label, execute: doIterativeWithdraw, opts: contOpts };
      }

      case 'deposit_items':
        return {
          label: step.label,
          execute: () => ws.depositItems(cmd.params!.itemId as string, cmd.params!.quantity as number),
          opts,
        };

      case 'withdraw_items':
        return {
          label: step.label,
          execute: () => ws.withdrawItems(cmd.params!.itemId as string, cmd.params!.quantity as number),
          opts,
        };

      case 'attack':
        return {
          label: step.label,
          execute: () => ws.attack(cmd.params!.targetId as string),
          opts,
        };

      case 'scan':
        return {
          label: step.label,
          execute: () => ws.scan(cmd.params?.targetId as string | undefined),
          opts,
        };

      case 'set_home_base':
        return {
          label: step.label,
          execute: () => ws.setHomeBase(cmd.params!.baseId as string),
          opts,
        };

      case 'repair':
        return {
          label: step.label,
          execute: () => ws.repair(),
          opts,
        };

      case 'refuel':
        return {
          label: step.label,
          execute: () => ws.refuel(),
          opts,
        };

      case 'survey_system':
        return {
          label: step.label,
          execute: () => ws.surveySystem(),
          opts,
        };

      default:
        // Unknown command — log warning and no-op
        return {
          label: step.label,
          execute: () => {
            eventsStore.add({ type: 'error', message: `[Loop] 不明なコマンド: ${cmd.type}` });
          },
          opts,
        };
    }
  }
}

export const loopStore = new LoopStore();
