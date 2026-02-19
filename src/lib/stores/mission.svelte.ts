import type { Mission } from '$lib/types/game';

/** Normalize server mission data: flatten rewards/giver/dialog objects */
function normalizeMission(raw: Record<string, unknown>): Mission {
  const m = raw as Mission;
  // Flatten rewards object → reward_credits, reward_xp, reward_items
  if (m.rewards) {
    m.reward_credits = m.rewards.credits ?? 0;
    m.reward_xp = m.rewards.skill_xp;
    m.reward_items = m.rewards.items ?? [];
  }
  if (m.reward_credits == null) m.reward_credits = 0;
  if (!m.reward_items) m.reward_items = [];
  // Flatten giver object → giver_name
  if (m.giver) {
    m.giver_name = m.giver.name;
  }
  // Flatten dialog object → giver_dialog, decline_dialog
  if (m.dialog) {
    m.giver_dialog = m.dialog.offer;
    m.decline_dialog = m.dialog.decline;
  }
  // Ensure objectives is always an array
  if (!m.objectives) m.objectives = [];
  // Ensure id fallback
  if (!m.id && m.mission_id) m.id = m.mission_id;
  return m;
}

class MissionStore {
  /** Available missions at the current station (from get_missions) */
  available = $state<Mission[]>([]);
  /** Player's active/accepted missions (from get_active_missions) */
  active = $state<Mission[]>([]);
  /** Max active missions allowed */
  maxMissions = $state(5);
  /** Loading flags */
  loadingAvailable = $state(false);
  loadingActive = $state(false);
  /** Station info from get_missions */
  baseName = $state('');
  baseId = $state('');

  setAvailable(missions: unknown[], baseName?: string, baseId?: string) {
    this.available = (missions ?? []).map(m => normalizeMission(m as Record<string, unknown>));
    if (baseName) this.baseName = baseName;
    if (baseId) this.baseId = baseId;
    this.loadingAvailable = false;
  }

  setActive(missions: unknown[] | null, maxMissions?: number) {
    this.active = (missions ?? []).map(m => normalizeMission(m as Record<string, unknown>));
    if (maxMissions != null) this.maxMissions = maxMissions;
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
    this.baseName = '';
    this.baseId = '';
  }
}

export const missionStore = new MissionStore();
