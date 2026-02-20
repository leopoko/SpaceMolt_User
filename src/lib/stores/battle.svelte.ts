import type { BattleStatus, BattleZone, BattleStance, BattleParticipant } from '$lib/types/game';

class BattleStore {
  status = $state<BattleStatus | null>(null);
  loading = $state(false);
  lastPollTick = $state(0);
  /** Summary from battle_ended (shown briefly after battle) */
  endedSummary = $state<Record<string, unknown> | null>(null);

  get inBattle(): boolean {
    return this.status !== null;
  }

  get myZone(): BattleZone | undefined {
    return this.status?.my_zone;
  }

  get myStance(): BattleStance | undefined {
    return this.status?.my_stance;
  }

  get mySideId(): number | undefined {
    return this.status?.my_side_id;
  }

  get myTargetId(): string | undefined {
    return this.status?.my_target_id;
  }

  get participants(): BattleParticipant[] {
    return this.status?.participants ?? [];
  }

  get sides() {
    return this.status?.sides ?? [];
  }

  /** Participants grouped by zone */
  get participantsByZone(): Record<BattleZone, BattleParticipant[]> {
    const zones: Record<BattleZone, BattleParticipant[]> = {
      outer: [],
      mid: [],
      inner: [],
      engaged: []
    };
    for (const p of this.participants) {
      if (zones[p.zone]) {
        zones[p.zone].push(p);
      }
    }
    return zones;
  }

  getEnemies(mySideId: number): BattleParticipant[] {
    return this.participants.filter(p => p.side_id !== mySideId && !p.is_destroyed);
  }

  getAllies(mySideId: number): BattleParticipant[] {
    return this.participants.filter(p => p.side_id === mySideId && !p.is_destroyed);
  }

  /** Normalize server data (your_ → my_, hull_pct → hull_percent) and store */
  setStatus(data: BattleStatus) {
    // Normalize your_ prefixed fields → my_
    data.my_side_id = data.my_side_id ?? data.your_side_id;
    data.my_zone = data.my_zone ?? data.your_zone;
    data.my_stance = data.my_stance ?? data.your_stance;
    data.my_target_id = data.my_target_id ?? data.your_target_id;

    // Normalize participants: hull_pct → hull_percent, shield_pct → shield_percent
    if (data.participants) {
      for (const p of data.participants) {
        p.hull_percent = p.hull_percent ?? p.hull_pct ?? 100;
        p.shield_percent = p.shield_percent ?? p.shield_pct ?? 0;
        p.ship_class = p.ship_class ?? '?';
        p.is_fleeing = p.is_fleeing ?? false;
        p.is_destroyed = p.is_destroyed ?? false;
      }
    }

    this.status = data;
    this.loading = false;
    this.endedSummary = null;
  }

  setLoading(value: boolean) {
    this.loading = value;
  }

  clear() {
    this.status = null;
    this.loading = false;
  }

  reset() {
    this.status = null;
    this.loading = false;
    this.lastPollTick = 0;
    this.endedSummary = null;
  }
}

export const battleStore = new BattleStore();
