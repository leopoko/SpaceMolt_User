import type { SystemInfo, POI, TravelState } from '$lib/types/game';

class SystemStore {
  data = $state<SystemInfo | null>(null);
  currentPoi = $state<POI | null>(null);
  travel = $state<TravelState>({
    in_progress: false,
    destination_id: null,
    destination_name: null,
    arrival_tick: null,
    current_tick: 0,
    type: null
  });

  get name(): string { return this.data?.name ?? 'Unknown'; }
  get securityLevel() { return this.data?.security_level ?? 'null'; }
  get pois(): POI[] { return this.data?.pois ?? []; }
  get connections() { return this.data?.connections ?? []; }
  get nearbyPlayers() { return this.data?.nearby_players ?? []; }
  get wrecks() { return this.data?.wrecks ?? []; }
  get asteroids(): POI[] {
    return this.pois.filter(p => p.type === 'asteroid');
  }
  get stations(): POI[] {
    return this.pois.filter(p => p.type === 'station');
  }

  update(partial: Partial<SystemInfo>) {
    if (this.data) {
      Object.assign(this.data, partial);
    } else {
      this.data = partial as SystemInfo;
    }
  }

  setTravel(state: Partial<TravelState>) {
    Object.assign(this.travel, state);
  }

  reset() {
    this.data = null;
    this.currentPoi = null;
    this.travel = {
      in_progress: false,
      destination_id: null,
      destination_name: null,
      arrival_tick: null,
      current_tick: 0,
      type: null
    };
  }
}

export const systemStore = new SystemStore();
