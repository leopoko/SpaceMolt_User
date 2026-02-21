import type { ActionCommand } from '$lib/stores/actionQueue.svelte';
import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
import { eventsStore } from '$lib/stores/events.svelte';
import { ws } from '$lib/services/websocket';
import { shipStore } from '$lib/stores/ship.svelte';
import { baseStore } from '$lib/stores/base.svelte';
import { playerStore } from '$lib/stores/player.svelte';
import { systemStore } from '$lib/stores/system.svelte';
import { systemMemoStore } from '$lib/stores/systemMemo.svelte';
import { userDataSync } from '$lib/services/userDataSync';
import { prefixKey } from './storagePrefix';

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
  /** The system where the loop's base station is located. */
  systemId?: string;
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
  /** The system where recording started. */
  recordingSystemId = $state<string | null>(null);

  /** All saved loops (loaded from localStorage). */
  savedLoops = $state<SavedLoop[]>([]);

  /** Currently playing loop info. */
  isPlaying = $state(false);
  playingLoopId = $state<string | null>(null);
  currentIteration = $state(0);
  totalIterations = $state(0); // 0 = infinite
  /** Whether the loop is in error recovery mode (returning to base). */
  isRecovering = $state(false);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(prefixKey(STORAGE_KEY));
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
      localStorage.setItem(prefixKey(STORAGE_KEY), JSON.stringify(this.savedLoops));
    } catch {
      // ignore
    }
    userDataSync.notifyChange();
  }

  /** Start recording at the current station. */
  startRecording(stationId: string, stationName: string) {
    this.isRecording = true;
    this.recordingStationId = stationId;
    this.recordingStationName = stationName;
    this.recordingSystemId = playerStore.system_id || null;
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
    this.recordingSystemId = null;
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
      systemId: this.recordingSystemId ?? (playerStore.system_id || undefined),
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
    this.recordingSystemId = null;
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
    this.isRecovering = false;
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
  private replayCommand(step: LoopStep): { label: string; execute: () => void; opts?: { continueOnError?: boolean; command?: ActionCommand; persistent?: boolean } } {
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
          opts: { ...opts, persistent: true },
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

      case 'wait':
        // No-op action that simply consumes a tick (1-tick delay)
        return {
          label: step.label || 'Wait 1 tick',
          execute: () => {
            ws.getStatus(); // harmless query to consume the tick slot
          },
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

  /**
   * Error codes that are safe to skip during loop playback.
   * These indicate the action was unnecessary (already done), not a real failure.
   */
  private static readonly SKIPPABLE_ERROR_CODES = new Set([
    // Resource already at maximum — action was simply redundant
    'hull_full',        // "Hull is already at maximum integrity"
    'tank_full',        // "Fuel tank is already full"
    'shield_full',      // Shield already full (if exists)
    'already_docked',   // Already docked at this station
    'already_undocked', // Already undocked
    'already_repaired', // Variant of hull_full
    'no_damage',        // No damage to repair
    // Timing issues — safe to skip, next tick will retry naturally
    'already_pending',  // "Another action is already pending"
    'action_pending',   // Variant
    // Storage edge cases — not worth stopping a loop
    'nothing_to_deposit',   // No cargo to deposit
    'nothing_to_withdraw',  // No items to withdraw
    'cargo_empty',          // Cargo is empty
    'storage_empty',        // Storage is empty
  ]);

  /**
   * Check if an error is safe to skip during loop playback.
   * Returns true if the loop should silently continue to the next step.
   */
  isSkippableError(code?: string, message?: string): boolean {
    if (!this.isPlaying) return false;

    // Check error code directly
    if (code && LoopStore.SKIPPABLE_ERROR_CODES.has(code)) return true;

    // Fallback: pattern-match on message text for servers that don't send codes
    if (message) {
      const msg = message.toLowerCase();
      if (msg.includes('already at maximum') || msg.includes('already full')) return true;
      if (msg.includes('no repairs needed') || msg.includes('no refueling needed')) return true;
      if (msg.includes('already docked') || msg.includes('already undocked')) return true;
      if (msg.includes('nothing to deposit') || msg.includes('nothing to withdraw')) return true;
      if (msg.includes('already pending') || msg.includes('action is already pending')) return true;
    }

    return false;
  }

  /**
   * Start error recovery: return to the loop's base station and restart the loop.
   * Called when an error occurs during loop playback.
   * Each recovery step is separated by a wait action (1-tick interval).
   */
  startRecovery() {
    if (!this.isPlaying || !this.playingLoopId) return;

    const loop = this.savedLoops.find(l => l.id === this.playingLoopId);
    if (!loop) {
      this.stopLoop();
      return;
    }

    // Clear remaining queue items from the failed iteration
    actionQueueStore.clear();
    this.isRecovering = true;

    eventsStore.add({
      type: 'info',
      message: `[Loop] エラー発生 — ${loop.stationName} への復帰を開始`
    });

    const currentSystem = playerStore.system_id;
    const targetSystem = loop.systemId;
    const targetStationId = loop.stationId;
    const isDocked = playerStore.isDocked;

    // Build recovery steps with wait actions between each step
    const enqueueWait = () => {
      actionQueueStore.enqueue('Wait 1 tick', () => {
        ws.getStatus();
      }, { command: { type: 'wait' }, continueOnError: true });
    };

    // Step 1: If currently docked somewhere else, undock first
    if (isDocked) {
      actionQueueStore.enqueue('[Recovery] Undock', () => ws.undock(), {
        command: { type: 'undock' },
        continueOnError: true,
      });
      enqueueWait();
    }

    // Step 2: If in a different system, jump back to the loop's home system
    if (targetSystem && currentSystem && currentSystem !== targetSystem) {
      // Check if we can jump directly (adjacent system)
      const directConnection = systemStore.connections.find(c => c.system_id === targetSystem);
      if (directConnection) {
        actionQueueStore.enqueue(`[Recovery] Jump → ${directConnection.system_name}`, () => {
          ws.jump(targetSystem, directConnection.system_name);
        }, {
          command: { type: 'jump', params: { systemId: targetSystem, systemName: directConnection.system_name } },
          persistent: true,
          continueOnError: true,
        });
        enqueueWait();
      } else {
        // Not directly connected — try to find route via system memo connections
        const route = this.findRouteHome(currentSystem, targetSystem);
        if (route.length > 0) {
          for (const hop of route) {
            actionQueueStore.enqueue(`[Recovery] Jump → ${hop.systemName}`, () => {
              ws.jump(hop.systemId, hop.systemName);
            }, {
              command: { type: 'jump', params: { systemId: hop.systemId, systemName: hop.systemName } },
              persistent: true,
              continueOnError: true,
            });
            enqueueWait();
          }
        } else {
          // Can't find route — give up recovery
          eventsStore.add({
            type: 'error',
            message: `[Loop] 復帰失敗: ${targetSystem} への経路が不明です`
          });
          this.isRecovering = false;
          this.stopLoop();
          return;
        }
      }
    }

    // Step 3: Travel to the station POI
    // Find the station POI in the current system data or memo
    const stationPoi = this.findStationPoi(targetSystem ?? currentSystem, targetStationId);
    if (stationPoi) {
      actionQueueStore.enqueue(`[Recovery] Travel → ${stationPoi.name}`, () => {
        ws.travel(stationPoi.id);
      }, {
        command: { type: 'travel', params: { poiId: stationPoi.id } },
        continueOnError: true,
      });
      enqueueWait();
    }

    // Step 4: Dock at the station
    actionQueueStore.enqueue(`[Recovery] Dock @ ${loop.stationName}`, () => {
      ws.dock(targetStationId);
    }, {
      command: { type: 'dock', params: { stationId: targetStationId } },
      continueOnError: true,
    });
    enqueueWait();

    // Step 5: Sentinel to complete recovery and restart loop
    actionQueueStore.enqueue(`[Recovery] ${loop.name} 再開`, () => {
      this.onRecoveryComplete();
    }, { command: { type: '_recovery_sentinel' } });
  }

  /** Called when recovery steps complete — restart the loop. */
  private onRecoveryComplete() {
    this.isRecovering = false;

    if (!this.isPlaying || !this.playingLoopId) return;

    const loop = this.savedLoops.find(l => l.id === this.playingLoopId);
    if (!loop) {
      this.stopLoop();
      return;
    }

    // Check if we're actually docked at the right station
    if (!playerStore.isDocked) {
      eventsStore.add({
        type: 'error',
        message: `[Loop] 復帰失敗: ドッキングできませんでした。ループを停止します。`
      });
      this.stopLoop();
      return;
    }

    eventsStore.add({
      type: 'info',
      message: `[Loop] 復帰完了 — ${loop.name} を再開 (イテレーション ${this.currentIteration})`
    });

    // Restart the current iteration
    this.enqueueLoopSteps(loop);
  }

  /**
   * Find route from current system to target system using system memo data.
   * BFS through memo connections. Returns array of hops (excluding current system).
   */
  private findRouteHome(fromSystem: string, toSystem: string): { systemId: string; systemName: string }[] {
    // BFS using system memos
    const visited = new Set<string>();
    const queue: { systemId: string; path: { systemId: string; systemName: string }[] }[] = [];

    visited.add(fromSystem);

    // Start with connections from the current system (live data + memo)
    const startConnections = [
      ...systemStore.connections.map(c => ({ system_id: c.system_id, system_name: c.system_name })),
    ];
    // Also add memo connections for current system if available
    const fromMemo = systemMemoStore.getMemo(fromSystem);
    if (fromMemo) {
      for (const mc of fromMemo.connections) {
        if (!startConnections.find(c => c.system_id === mc.system_id)) {
          startConnections.push({ system_id: mc.system_id, system_name: mc.system_name });
        }
      }
    }

    for (const conn of startConnections) {
      if (conn.system_id === toSystem) {
        return [{ systemId: conn.system_id, systemName: conn.system_name }];
      }
      if (!visited.has(conn.system_id)) {
        visited.add(conn.system_id);
        queue.push({
          systemId: conn.system_id,
          path: [{ systemId: conn.system_id, systemName: conn.system_name }],
        });
      }
    }

    // BFS through memos (max depth 10 to avoid infinite loops)
    while (queue.length > 0 && queue[0].path.length < 10) {
      const current = queue.shift()!;
      const memo = systemMemoStore.getMemo(current.systemId);
      if (!memo) continue;

      for (const conn of memo.connections) {
        if (conn.system_id === toSystem) {
          return [...current.path, { systemId: conn.system_id, systemName: conn.system_name }];
        }
        if (!visited.has(conn.system_id)) {
          visited.add(conn.system_id);
          queue.push({
            systemId: conn.system_id,
            path: [...current.path, { systemId: conn.system_id, systemName: conn.system_name }],
          });
        }
      }
    }

    return []; // No route found
  }

  /** Find the station POI in system data or memo. */
  private findStationPoi(systemId: string, stationId: string): { id: string; name: string } | null {
    // Check live system data first
    const livePoi = systemStore.pois.find(p => p.id === stationId);
    if (livePoi) return { id: livePoi.id, name: livePoi.name };

    // Fall back to system memo
    const memo = systemMemoStore.getMemo(systemId);
    if (memo) {
      const memoPoi = memo.pois.find(p => p.id === stationId);
      if (memoPoi) return { id: memoPoi.id, name: memoPoi.name };
    }

    return null;
  }

  /** Enqueue a single wait action (1-tick delay). Usable outside of loops too. */
  enqueueWait() {
    actionQueueStore.enqueue('Wait 1 tick', () => {
      ws.getStatus();
    }, { command: { type: 'wait' } });
  }

  reset() {
    if (this.isPlaying) this.stopLoop();
    if (this.isRecording) this.cancelRecording();
    this.isPlaying = false;
    this.playingLoopId = null;
    this.currentIteration = 0;
    this.totalIterations = 0;
    this.isRecovering = false;
  }
}

export const loopStore = new LoopStore();
