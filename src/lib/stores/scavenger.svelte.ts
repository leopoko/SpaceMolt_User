import type { Wreck } from '$lib/types/game';

class ScavengerStore {
  wrecks = $state<Wreck[]>([]);
  loading = $state(false);
  selectedWreckId = $state<string | null>(null);

  get selectedWreck(): Wreck | null {
    if (!this.selectedWreckId) return null;
    return this.wrecks.find(w => w.id === this.selectedWreckId) ?? null;
  }

  setWrecks(wrecks: Wreck[]) {
    this.wrecks = wrecks;
    this.loading = false;
    // Clear selection if the selected wreck no longer exists
    if (this.selectedWreckId && !wrecks.find(w => w.id === this.selectedWreckId)) {
      this.selectedWreckId = null;
    }
  }

  selectWreck(id: string | null) {
    this.selectedWreckId = this.selectedWreckId === id ? null : id;
  }

  reset() {
    this.wrecks = [];
    this.loading = false;
    this.selectedWreckId = null;
  }
}

export const scavengerStore = new ScavengerStore();
