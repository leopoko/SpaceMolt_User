import type { Faction } from '$lib/types/game';

class FactionStore {
  data = $state<Faction | null>(null);

  get name(): string { return this.data?.name ?? ''; }
  get members() { return this.data?.members ?? []; }
  get wars() { return this.data?.wars ?? []; }
  get allies(): string[] { return this.data?.allies ?? []; }
  get credits(): number { return this.data?.credits ?? 0; }

  update(data: Faction) {
    this.data = data;
  }

  reset() {
    this.data = null;
  }
}

export const factionStore = new FactionStore();
