import type { CombatEvent, ScanResult } from '$lib/types/game';

const MAX_COMBAT_LOG = 100;

class CombatStore {
  inCombat = $state(false);
  combatLog = $state<CombatEvent[]>([]);
  scanResult = $state<ScanResult | null>(null);
  lastAttackTarget = $state<string | null>(null);

  addEvent(event: CombatEvent) {
    this.combatLog = [event, ...this.combatLog].slice(0, MAX_COMBAT_LOG);
  }

  setScanResult(result: ScanResult) {
    this.scanResult = result;
  }

  setInCombat(value: boolean) {
    this.inCombat = value;
  }

  reset() {
    this.inCombat = false;
    this.combatLog = [];
    this.scanResult = null;
  }
}

export const combatStore = new CombatStore();
