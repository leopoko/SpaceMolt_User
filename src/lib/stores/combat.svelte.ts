import type { CombatEvent, ScanResult, TargetScanResult } from '$lib/types/game';

const MAX_COMBAT_LOG = 100;

class CombatStore {
  inCombat = $state(false);
  combatLog = $state<CombatEvent[]>([]);
  scanResult = $state<ScanResult | null>(null);
  lastAttackTarget = $state<string | null>(null);
  /** Per-target scan results keyed by target_id */
  targetScans = $state<Record<string, TargetScanResult>>({});

  addEvent(event: CombatEvent) {
    this.combatLog = [event, ...this.combatLog].slice(0, MAX_COMBAT_LOG);
  }

  setScanResult(result: ScanResult) {
    this.scanResult = result;
  }

  setTargetScan(result: TargetScanResult) {
    this.targetScans = { ...this.targetScans, [result.target_id]: result };
  }

  getTargetScan(targetId: string): TargetScanResult | undefined {
    return this.targetScans[targetId];
  }

  setInCombat(value: boolean) {
    this.inCombat = value;
  }

  reset() {
    this.inCombat = false;
    this.combatLog = [];
    this.scanResult = null;
    this.targetScans = {};
  }
}

export const combatStore = new CombatStore();
