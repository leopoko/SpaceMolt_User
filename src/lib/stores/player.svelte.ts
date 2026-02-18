import type { Player, Skill, Mission, Achievement } from '$lib/types/game';

class PlayerStore {
  data = $state<Player | null>(null);

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
  }

  reset() {
    this.data = null;
  }
}

export const playerStore = new PlayerStore();
