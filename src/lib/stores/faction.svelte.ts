import type { Faction } from '$lib/types/game';

export interface FactionListItem {
  id: string;
  name: string;
  tag: string;
  description?: string;
  leader_name?: string;
  leader_username?: string;
  member_count?: number;
  owned_bases?: number;
  standing?: number;
  primary_color?: string;
  secondary_color?: string;
}

export interface FactionInvite {
  faction_id: string;
  faction_name: string;
  faction_tag?: string;
  invited_by?: string;
  invited_at?: string;
}

class FactionStore {
  data = $state<Faction | null>(null);

  // Faction list (from faction_list)
  factionList = $state<FactionListItem[]>([]);
  factionListTotal = $state(0);
  factionListLoading = $state(false);

  // Viewing another faction's info
  viewedFaction = $state<Faction | null>(null);
  viewedFactionLoading = $state(false);

  // Invites
  invites = $state<FactionInvite[]>([]);
  invitesLoading = $state(false);

  get name(): string { return this.data?.name ?? ''; }
  get leaderName(): string { return this.data?.leader_username ?? this.data?.leader_name ?? ''; }
  get members() { return this.data?.members ?? []; }
  get wars() { return this.data?.wars ?? []; }
  get allies(): string[] { return this.data?.allies ?? []; }
  get credits(): number { return this.data?.credits ?? 0; }
  get memberCount(): number { return this.data?.member_count ?? this.data?.members?.length ?? 0; }

  update(data: Faction) {
    this.data = data;
  }

  setFactionList(items: FactionListItem[], total?: number) {
    this.factionList = items;
    this.factionListTotal = total ?? items.length;
    this.factionListLoading = false;
  }

  setViewedFaction(data: Faction) {
    this.viewedFaction = data;
    this.viewedFactionLoading = false;
  }

  clearViewedFaction() {
    this.viewedFaction = null;
  }

  setInvites(invites: FactionInvite[]) {
    this.invites = invites;
    this.invitesLoading = false;
  }

  reset() {
    this.data = null;
    this.factionList = [];
    this.factionListTotal = 0;
    this.viewedFaction = null;
    this.invites = [];
  }
}

export const factionStore = new FactionStore();
