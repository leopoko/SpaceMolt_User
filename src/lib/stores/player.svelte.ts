import type { Player, Skill, Mission, Achievement, PlayerStats } from '$lib/types/game';

const DOCK_KEY = 'sm_dock_state';

class PlayerStore {
  data = $state<Player | null>(null);

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(DOCK_KEY);
        if (saved) {
          const partial = JSON.parse(saved) as Pick<Player, 'docked_at_base' | 'current_poi' | 'status' | 'poi_id'>;
          this.data = partial as Player;
        }
      } catch {
        // ignore parse errors
      }
    }
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

  get skills(): Skill[] {
    const s = this.data?.skills;
    if (!s || !Array.isArray(s)) return [];
    return s as Skill[];
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
      localStorage.setItem(DOCK_KEY, JSON.stringify({
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
    try { localStorage.removeItem(DOCK_KEY); } catch { /* ignore */ }
  }
}

export const playerStore = new PlayerStore();
