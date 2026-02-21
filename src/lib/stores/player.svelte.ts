import type { Player, Skill, Mission, Achievement, PlayerStats } from '$lib/types/game';
import { userKey, migrateToUserKey } from './storagePrefix';

const DOCK_KEY = 'sm_dock_state';

class PlayerStore {
  data = $state<Player | null>(null);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(userKey(DOCK_KEY));
        if (saved) {
          const partial = JSON.parse(saved) as Pick<Player, 'docked_at_base' | 'current_poi' | 'status' | 'poi_id'>;
          this.data = partial as Player;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  /** Reload dock state from localStorage after user switch. Migrates old data if needed. */
  reload() {
    migrateToUserKey(DOCK_KEY);
    this.loadFromStorage();
  }

  // ---- Getters ----

  get credits(): number { return this.data?.credits ?? 0; }
  get username(): string { return this.data?.username ?? ''; }
  get empire(): string { return this.data?.empire ?? ''; }

  // Location – supports both legacy and new field names
  get location(): string { return this.data?.location ?? this.data?.current_system ?? 'Unknown'; }
  get system_id(): string { return this.data?.current_system ?? this.data?.system_id ?? ''; }

  // POI – current_poi (state_update) or poi_id (legacy events)
  get poi_id(): string | null { return this.data?.current_poi ?? this.data?.poi_id ?? null; }

  // Dock state – docked_at_base (state_update) or status === 'docked' (legacy)
  // Note: server omits docked_at_base entirely when undocked, so absence = not docked.
  get isDocked(): boolean {
    const db = this.data?.docked_at_base;
    if (db != null && db !== '') return true;
    // Only fall back to status if docked_at_base was never set (legacy path)
    if (db === undefined) return this.data?.status === 'docked';
    return false;
  }
  get dockedAt(): string | null { return this.data?.docked_at_base ?? null; }
  get homeBase(): string | null { return this.data?.home_base ?? null; }

  get status() { return this.data?.status ?? 'active'; }

  /**
   * Build a unified skill list from both formats:
   * - Array format (legacy): Skill[] directly
   * - Object format (state_update): { skill_id: level } combined with skill_xp { skill_id: xp }
   *   Level-0 skills appear only in skill_xp, not in skills map.
   */
  get skills(): Skill[] {
    const s = this.data?.skills;
    if (!s) return [];

    // Legacy array format
    if (Array.isArray(s)) return s as Skill[];

    // Object format: Record<string, number> → merge with skill_xp
    const skillLevels = s as Record<string, number>;
    const skillXp = this.data?.skill_xp ?? {};

    // Collect all skill IDs from both maps
    const allIds = new Set([...Object.keys(skillLevels), ...Object.keys(skillXp)]);
    const result: Skill[] = [];

    for (const id of allIds) {
      const level = skillLevels[id] ?? 0;
      const xp = skillXp[id] ?? 0;
      result.push({
        id,
        name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: '',
        level,
        max_level: 10,
        xp,
        next_level_xp: 0, // unknown from state_update; PlayerProfile handles this
        prerequisites: [],
      });
    }

    // Sort: highest level first, then by XP, then alphabetical
    result.sort((a, b) => b.level - a.level || b.xp - a.xp || a.name.localeCompare(b.name));
    return result;
  }
  get skillXp(): Record<string, number> { return this.data?.skill_xp ?? {}; }
  get experience(): number { return this.data?.experience ?? 0; }
  get stats(): PlayerStats | null { return this.data?.stats ?? null; }
  get missions(): Mission[] { return (this.data?.missions ?? []) as Mission[]; }
  get achievements(): Achievement[] { return (this.data?.achievements ?? []) as Achievement[]; }
  get faction_id(): string | null { return this.data?.faction_id ?? null; }
  get primaryColor(): string { return this.data?.primary_color ?? '#FFFFFF'; }
  get secondaryColor(): string { return this.data?.secondary_color ?? '#000000'; }
  get isCloaked(): boolean { return this.data?.is_cloaked ?? false; }

  update(partial: Partial<Player>) {
    if (this.data) {
      Object.assign(this.data, partial);
      // Full player objects from state_update omit docked_at_base when undocked.
      // Detect a "full" update by presence of 'id', and explicitly clear if absent.
      if ('id' in partial && !('docked_at_base' in partial)) {
        this.data.docked_at_base = null;
      }
    } else {
      this.data = { docked_at_base: null, ...partial } as Player;
    }
    // Persist dock-relevant fields for page-reload survival
    try {
      localStorage.setItem(userKey(DOCK_KEY), JSON.stringify({
        status: this.data?.status ?? null,
        docked_at_base: this.data?.docked_at_base ?? null,
        current_poi: this.data?.current_poi ?? null,
        poi_id: this.data?.poi_id ?? null
      }));
    } catch {
      // ignore storage errors
    }
  }

  reset() {
    this.data = null;
    try { localStorage.removeItem(userKey(DOCK_KEY)); } catch { /* ignore */ }
  }
}

export const playerStore = new PlayerStore();
