import type { Player, Skill, Mission, Achievement } from '$lib/types/game';

const DOCK_KEY = 'sm_dock_state';

class PlayerStore {
  data = $state<Player | null>(null);

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(DOCK_KEY);
        if (saved) {
          const partial = JSON.parse(saved) as Pick<Player, 'status' | 'poi_id'>;
          this.data = partial as Player;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  get credits(): number { return this.data?.credits ?? 0; }
  get location(): string { return this.data?.location ?? 'Unknown'; }
  get system_id(): string { return this.data?.system_id ?? ''; }
  get poi_id(): string | null { return this.data?.poi_id ?? null; }
  get status() { return this.data?.status ?? 'active'; }
  get isDocked(): boolean { return this.data?.status === 'docked'; }
  get skills(): Skill[] { return this.data?.skills ?? []; }
  get missions(): Mission[] { return this.data?.missions ?? []; }
  get achievements(): Achievement[] { return this.data?.achievements ?? []; }
  get empire(): string { return this.data?.empire ?? ''; }
  get faction_id(): string | null { return this.data?.faction_id ?? null; }

  update(partial: Partial<Player>) {
    if (this.data) {
      Object.assign(this.data, partial);
    } else {
      this.data = partial as Player;
    }
    // Persist dock state so it survives page refresh
    if (this.data?.status) {
      try {
        localStorage.setItem(DOCK_KEY, JSON.stringify({
          status: this.data.status,
          poi_id: this.data.poi_id ?? null
        }));
      } catch {
        // ignore storage errors (e.g. private browsing quota)
      }
    }
  }

  reset() {
    this.data = null;
    try {
      localStorage.removeItem(DOCK_KEY);
    } catch {
      // ignore
    }
  }
}

export const playerStore = new PlayerStore();
