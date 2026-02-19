import type { Mission } from '$lib/types/game';

class MissionStore {
  /** Available missions at the current station (from get_missions) */
  available = $state<Mission[]>([]);
  /** Player's active/accepted missions (from get_active_missions) */
  active = $state<Mission[]>([]);
  /** Loading flags */
  loadingAvailable = $state(false);
  loadingActive = $state(false);

  setAvailable(missions: Mission[]) {
    this.available = missions;
    this.loadingAvailable = false;
  }

  setActive(missions: Mission[]) {
    this.active = missions;
    this.loadingActive = false;
  }

  /** Remove a mission from active list (after abandon/complete) */
  removeActive(missionId: string) {
    this.active = this.active.filter(m => (m.mission_id ?? m.id) !== missionId);
  }

  reset() {
    this.available = [];
    this.active = [];
    this.loadingAvailable = false;
    this.loadingActive = false;
  }
}

export const missionStore = new MissionStore();
