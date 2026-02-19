<script lang="ts">
  import Card, { Content } from '@smui/card';
  import Button, { Label } from '@smui/button';
  import { factionStore } from '$lib/stores/faction.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { ws } from '$lib/services/websocket';

  type View = 'my-faction' | 'browse' | 'create' | 'invites' | 'view-faction';
  let view = $state<View>(playerStore.faction_id ? 'my-faction' : 'browse');

  // Create faction form
  let createName = $state('');
  let createTag = $state('');

  // Search
  let searchQuery = $state('');

  let filteredFactions = $derived.by(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return factionStore.factionList;
    return factionStore.factionList.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.tag.toLowerCase().includes(q) ||
      (f.description ?? '').toLowerCase().includes(q)
    );
  });

  function refreshMyFaction() {
    if (playerStore.faction_id) {
      ws.getFactionInfo(playerStore.faction_id);
    } else {
      ws.getFactionInfo();
    }
  }

  function loadFactionList() {
    ws.factionList();
  }

  function loadInvites() {
    ws.factionGetInvites();
    view = 'invites';
  }

  function viewFaction(factionId: string) {
    ws.factionViewInfo(factionId);
    view = 'view-faction';
  }

  function submitCreateFaction() {
    const name = createName.trim();
    const tag = createTag.trim().toUpperCase();
    if (!name || tag.length !== 4) return;
    ws.createFaction(name, tag);
    createName = '';
    createTag = '';
    view = 'my-faction';
  }

  function joinFaction(factionId: string) {
    ws.joinFaction(factionId);
  }

  function leaveFaction() {
    ws.leaveFaction();
    view = 'browse';
  }

  function declineInvite(factionId: string) {
    ws.factionDeclineInvite(factionId);
  }

  // Auto-load on mount
  if (playerStore.faction_id) {
    refreshMyFaction();
  }
  loadFactionList();
  ws.factionGetInvites();
</script>

<!-- Navigation bar -->
<div class="faction-nav">
  {#if playerStore.faction_id}
    <button class="nav-btn" class:active={view === 'my-faction'} onclick={() => { view = 'my-faction'; refreshMyFaction(); }}>
      <span class="material-icons" style="font-size:14px">shield</span> My Faction
    </button>
  {/if}
  <button class="nav-btn" class:active={view === 'browse'} onclick={() => { view = 'browse'; loadFactionList(); }}>
    <span class="material-icons" style="font-size:14px">search</span> Browse
  </button>
  <button class="nav-btn" class:active={view === 'invites'} onclick={loadInvites}>
    <span class="material-icons" style="font-size:14px">mail</span> Invites
    {#if factionStore.invites.length > 0}
      <span class="invite-badge">{factionStore.invites.length}</span>
    {/if}
  </button>
  {#if !playerStore.faction_id}
    <button class="nav-btn accent" class:active={view === 'create'} onclick={() => { view = 'create'; }}>
      <span class="material-icons" style="font-size:14px">add</span> Create
    </button>
  {/if}
</div>

{#if view === 'my-faction'}
  <!-- My Faction View -->
  {#if factionStore.data}
    <div class="three-col">
      <!-- Overview -->
      <Card class="space-card">
        <Content>
          <div class="section-head">
            <span class="tab-section-title">Overview</span>
            <button class="icon-btn" onclick={refreshMyFaction}>
              <span class="material-icons" style="font-size:16px">refresh</span>
            </button>
          </div>

          <h2 class="faction-name">
            {#if factionStore.data.tag}<span class="faction-tag-header">[{factionStore.data.tag}]</span> {/if}{factionStore.name}
          </h2>
          <p class="faction-desc">{factionStore.data.description}</p>

          <div class="faction-stats">
            <div class="f-stat">
              <span class="f-label">Leader</span>
              <span class="f-val">{factionStore.data.leader_name}</span>
            </div>
            <div class="f-stat">
              <span class="f-label">Members</span>
              <span class="f-val mono">{factionStore.members.length}</span>
            </div>
            <div class="f-stat">
              <span class="f-label">Faction Credits</span>
              <span class="f-val mono credits">₡{factionStore.credits.toLocaleString()}</span>
            </div>
            <div class="f-stat">
              <span class="f-label">At War With</span>
              <span class="f-val mono" class:war={factionStore.wars.length > 0}>
                {factionStore.wars.length} factions
              </span>
            </div>
            <div class="f-stat">
              <span class="f-label">Allies</span>
              <span class="f-val mono">{factionStore.allies.length} factions</span>
            </div>
          </div>

          <div class="faction-actions">
            <Button variant="outlined" dense onclick={leaveFaction} style="font-size:0.62rem; color:#ef5350; border-color:rgba(239,83,80,0.3)">
              <Label>Leave Faction</Label>
            </Button>
          </div>
        </Content>
      </Card>

      <!-- Members -->
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Members ({factionStore.members.length})</p>

          {#if factionStore.members.length > 0}
            <div class="member-list">
              {#each factionStore.members as member}
                <div class="member-item">
                  <div class="member-info">
                    <span class="member-name">{member.username}</span>
                    <span class="member-role mono" class:leader={member.role === 'leader'} class:officer={member.role === 'officer'}>
                      {member.role.toUpperCase()}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-hint">No member data</p>
          {/if}
        </Content>
      </Card>

      <!-- Wars & Allies -->
      <Card class="space-card">
        <Content>
          <p class="tab-section-title">Active Wars</p>

          {#if factionStore.wars.length > 0}
            <div class="war-list">
              {#each factionStore.wars as war}
                <div class="war-item">
                  <span class="war-name">{war.faction_name}</span>
                  <div class="war-stats">
                    <span class="kills mono">+{war.kills} kills</span>
                    <span class="losses mono">-{war.losses} losses</span>
                  </div>
                  <Button
                    variant="outlined"
                    dense
                    onclick={() => ws.proposePeace(war.faction_id)}
                    style="font-size:0.62rem"
                  >
                    <Label>Propose Peace</Label>
                  </Button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-hint">No active wars</p>
          {/if}

          <p class="tab-section-title" style="margin-top:16px">Allied Factions</p>
          {#if factionStore.allies.length > 0}
            <div class="ally-list">
              {#each factionStore.allies as ally}
                <div class="ally-item">{ally}</div>
              {/each}
            </div>
          {:else}
            <p class="empty-hint">No allies</p>
          {/if}
        </Content>
      </Card>
    </div>
  {:else if playerStore.faction_id}
    <p class="empty-hint">Loading faction info...</p>
  {:else}
    <p class="empty-hint">You are not in a faction. Browse factions or create your own.</p>
  {/if}

{:else if view === 'browse'}
  <!-- Browse Factions -->
  <div class="browse-view">
    <div class="search-row">
      <input
        class="search-input"
        bind:value={searchQuery}
        placeholder="Search factions by name or tag..."
      />
      <button class="icon-btn" onclick={loadFactionList}>
        <span class="material-icons" style="font-size:16px">refresh</span>
      </button>
    </div>

    {#if factionStore.factionListLoading}
      <p class="loading-hint">Loading factions...</p>
    {:else if filteredFactions.length === 0}
      <p class="empty-hint">{searchQuery ? 'No factions match your search' : 'No factions found'}</p>
    {:else}
      <div class="faction-grid">
        {#each filteredFactions as faction (faction.id)}
          <div class="faction-card">
            <div class="fc-header">
              <span class="fc-tag">[{faction.tag}]</span>
              <span class="fc-name">{faction.name}</span>
            </div>
            {#if faction.description}
              <p class="fc-desc">{faction.description}</p>
            {/if}
            <div class="fc-meta">
              {#if faction.leader_name}
                <span class="fc-leader">
                  <span class="material-icons" style="font-size:11px">person</span> {faction.leader_name}
                </span>
              {/if}
              {#if faction.member_count !== undefined}
                <span class="fc-members">
                  <span class="material-icons" style="font-size:11px">groups</span> {faction.member_count}
                </span>
              {/if}
            </div>
            <div class="fc-actions">
              <button class="tool-btn small" onclick={() => viewFaction(faction.id)}>
                <span class="material-icons" style="font-size:12px">visibility</span> View
              </button>
            </div>
          </div>
        {/each}
      </div>
      <p class="result-count">{filteredFactions.length} faction{filteredFactions.length !== 1 ? 's' : ''} found</p>
    {/if}
  </div>

{:else if view === 'create'}
  <!-- Create Faction -->
  <div class="create-view">
    <Card class="space-card">
      <Content>
        <p class="tab-section-title">Create New Faction</p>

        <div class="form-group">
          <label class="form-label">Faction Name</label>
          <input
            class="form-input"
            bind:value={createName}
            placeholder="Enter faction name..."
            maxlength={50}
          />
        </div>

        <div class="form-group">
          <label class="form-label">Tag (exactly 4 characters)</label>
          <input
            class="form-input mono"
            bind:value={createTag}
            placeholder="ABCD"
            maxlength={4}
            style="text-transform: uppercase; width: 120px;"
          />
          <span class="form-hint">{createTag.length}/4 characters</span>
        </div>

        <Button variant="outlined" dense onclick={submitCreateFaction} disabled={!createName.trim() || createTag.trim().length !== 4}>
          <Label>Create Faction</Label>
        </Button>
      </Content>
    </Card>
  </div>

{:else if view === 'invites'}
  <!-- Invites -->
  <div class="invites-view">
    {#if factionStore.invitesLoading}
      <p class="loading-hint">Loading invites...</p>
    {:else if factionStore.invites.length === 0}
      <p class="empty-hint">No pending invites</p>
    {:else}
      <div class="invite-list">
        {#each factionStore.invites as invite (invite.faction_id)}
          <div class="invite-item">
            <div class="invite-info">
              <span class="invite-name">
                {#if invite.faction_tag}<span class="fc-tag">[{invite.faction_tag}]</span> {/if}{invite.faction_name}
              </span>
              {#if invite.invited_by}
                <span class="invite-from">Invited by {invite.invited_by}</span>
              {/if}
            </div>
            <div class="invite-actions">
              {#if !playerStore.faction_id}
                <Button variant="outlined" dense onclick={() => joinFaction(invite.faction_id)} style="font-size:0.62rem">
                  <Label>Accept</Label>
                </Button>
              {/if}
              <Button variant="outlined" dense onclick={() => declineInvite(invite.faction_id)} style="font-size:0.62rem; color:#ef5350; border-color:rgba(239,83,80,0.3)">
                <Label>Decline</Label>
              </Button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

{:else if view === 'view-faction'}
  <!-- View Faction Detail -->
  <div class="view-faction-view">
    <div class="faction-nav" style="margin-bottom:8px">
      <button class="nav-btn" onclick={() => { factionStore.clearViewedFaction(); view = 'browse'; }}>
        <span class="material-icons" style="font-size:14px">arrow_back</span> Back
      </button>
    </div>

    {#if factionStore.viewedFactionLoading}
      <p class="loading-hint">Loading faction info...</p>
    {:else if factionStore.viewedFaction}
      <div class="three-col">
        <Card class="space-card">
          <Content>
            <h2 class="faction-name">
              {#if factionStore.viewedFaction.tag}<span class="faction-tag-header">[{factionStore.viewedFaction.tag}]</span> {/if}{factionStore.viewedFaction.name}
            </h2>
            <p class="faction-desc">{factionStore.viewedFaction.description}</p>

            <div class="faction-stats">
              <div class="f-stat">
                <span class="f-label">Leader</span>
                <span class="f-val">{factionStore.viewedFaction.leader_name}</span>
              </div>
              <div class="f-stat">
                <span class="f-label">Members</span>
                <span class="f-val mono">{factionStore.viewedFaction.members?.length ?? '?'}</span>
              </div>
              {#if factionStore.viewedFaction.standing !== undefined}
                <div class="f-stat">
                  <span class="f-label">Standing</span>
                  <span class="f-val mono">{factionStore.viewedFaction.standing}</span>
                </div>
              {/if}
            </div>
          </Content>
        </Card>

        <Card class="space-card">
          <Content>
            <p class="tab-section-title">Members</p>
            {#if factionStore.viewedFaction.members && factionStore.viewedFaction.members.length > 0}
              <div class="member-list">
                {#each factionStore.viewedFaction.members as member}
                  <div class="member-item">
                    <div class="member-info">
                      <span class="member-name">{member.username}</span>
                      <span class="member-role mono" class:leader={member.role === 'leader'} class:officer={member.role === 'officer'}>
                        {member.role.toUpperCase()}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="empty-hint">Member data not available</p>
            {/if}
          </Content>
        </Card>

        <Card class="space-card">
          <Content>
            <p class="tab-section-title">Wars & Allies</p>
            {#if factionStore.viewedFaction.wars && factionStore.viewedFaction.wars.length > 0}
              {#each factionStore.viewedFaction.wars as war}
                <div class="war-item">
                  <span class="war-name">{war.faction_name}</span>
                  <div class="war-stats">
                    <span class="kills mono">+{war.kills}</span>
                    <span class="losses mono">-{war.losses}</span>
                  </div>
                </div>
              {/each}
            {:else}
              <p class="empty-hint">No wars</p>
            {/if}

            {#if factionStore.viewedFaction.allies && factionStore.viewedFaction.allies.length > 0}
              <p class="tab-section-title" style="margin-top:12px">Allies</p>
              <div class="ally-list">
                {#each factionStore.viewedFaction.allies as ally}
                  <div class="ally-item">{ally}</div>
                {/each}
              </div>
            {/if}
          </Content>
        </Card>
      </div>
    {:else}
      <p class="empty-hint">Faction not found</p>
    {/if}
  </div>
{/if}

<style>
  /* ---- Navigation ---- */
  .faction-nav {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(79, 195, 247, 0.12);
    color: #546e7a;
    font-size: 0.7rem;
    padding: 4px 10px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
  }

  .nav-btn:hover { color: #90caf9; background: rgba(79, 195, 247, 0.06); border-color: rgba(79, 195, 247, 0.25); }
  .nav-btn.active { color: #4fc3f7; background: rgba(79, 195, 247, 0.1); border-color: rgba(79, 195, 247, 0.35); }
  .nav-btn.accent { color: #66bb6a; border-color: rgba(102,187,106,0.2); }
  .nav-btn.accent:hover { background: rgba(102,187,106,0.08); }
  .nav-btn.accent.active { color: #66bb6a; background: rgba(102,187,106,0.12); border-color: rgba(102,187,106,0.4); }

  .invite-badge {
    background: #ef5350;
    color: #fff;
    font-size: 0.55rem;
    font-weight: 700;
    padding: 0 4px;
    border-radius: 6px;
    min-width: 14px;
    text-align: center;
    line-height: 14px;
  }

  /* ---- Common ---- */
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .icon-btn {
    background: none;
    border: none;
    color: #546e7a;
    cursor: pointer;
    padding: 2px 4px;
  }

  .icon-btn:hover { color: #4fc3f7; }

  .empty-hint, .loading-hint {
    font-size: 0.75rem;
    color: #37474f;
    text-align: center;
    padding: 16px 0;
  }

  .faction-name {
    font-size: 1.15rem;
    font-weight: 300;
    letter-spacing: 0.06em;
    color: #b39ddb;
    margin: 0 0 6px 0;
  }

  .faction-tag-header {
    color: #78909c;
    font-size: 0.85rem;
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
  }

  .faction-desc {
    font-size: 0.75rem;
    color: #546e7a;
    margin: 0 0 12px 0;
    line-height: 1.4;
  }

  .faction-stats { display: flex; flex-direction: column; gap: 5px; }

  .f-stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.76rem;
    padding: 3px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .f-label { color: #4a6070; }
  .f-val { color: #90a4ae; }
  .f-val.war { color: #ef5350; }
  .credits { color: #ffd700; }

  .faction-actions {
    margin-top: 12px;
    display: flex;
    gap: 6px;
  }

  /* ---- Members ---- */
  .member-list { display: flex; flex-direction: column; gap: 3px; max-height: 400px; overflow-y: auto; }

  .member-item {
    padding: 5px 8px;
    background: rgba(255,255,255,0.02);
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.04);
  }

  .member-info { display: flex; justify-content: space-between; align-items: center; }
  .member-name { font-size: 0.78rem; color: #b0bec5; }
  .member-role { font-size: 0.6rem; color: #546e7a; }
  .member-role.leader { color: #ffd700; }
  .member-role.officer { color: #b39ddb; }

  /* ---- Wars & Allies ---- */
  .war-list { display: flex; flex-direction: column; gap: 5px; }

  .war-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px 8px;
    background: rgba(244,67,54,0.06);
    border: 1px solid rgba(244,67,54,0.15);
    border-radius: 4px;
    gap: 8px;
    flex-wrap: wrap;
  }

  .war-name { font-size: 0.78rem; color: #ef5350; }
  .war-stats { display: flex; gap: 8px; font-size: 0.66rem; }
  .kills { color: #4caf50; }
  .losses { color: #ef5350; }

  .ally-list { display: flex; flex-direction: column; gap: 3px; }

  .ally-item {
    padding: 4px 8px;
    background: rgba(76,175,80,0.06);
    border: 1px solid rgba(76,175,80,0.15);
    border-radius: 3px;
    font-size: 0.76rem;
    color: #66bb6a;
  }

  /* ---- Browse / Search ---- */
  .browse-view { display: flex; flex-direction: column; gap: 8px; }

  .search-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .search-input {
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 4px;
    color: #c0cfe0;
    font-size: 0.75rem;
    padding: 6px 10px;
    outline: none;
  }

  .search-input:focus { border-color: rgba(79,195,247,0.4); }

  .faction-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  @media (min-width: 700px) {
    .faction-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (min-width: 1100px) {
    .faction-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .faction-card {
    padding: 10px 12px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(79,195,247,0.08);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fc-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .fc-tag {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.68rem;
    font-weight: 600;
    color: #b39ddb;
    flex-shrink: 0;
  }

  .fc-name {
    font-size: 0.82rem;
    color: #b0bec5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fc-desc {
    font-size: 0.68rem;
    color: #4a6070;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
  }

  .fc-meta {
    display: flex;
    gap: 10px;
    font-size: 0.63rem;
    color: #546e7a;
    align-items: center;
  }

  .fc-leader, .fc-members {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .fc-actions {
    display: flex;
    gap: 4px;
    margin-top: 2px;
  }

  .tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: rgba(79,195,247,0.08);
    border: 1px solid rgba(79,195,247,0.2);
    color: #4fc3f7;
    font-size: 0.65rem;
    padding: 2px 7px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .tool-btn:hover { background: rgba(79,195,247,0.15); border-color: rgba(79,195,247,0.4); }
  .tool-btn.small { font-size: 0.62rem; padding: 2px 6px; }

  .result-count {
    font-size: 0.63rem;
    color: #37474f;
    text-align: center;
    padding: 4px 0;
  }

  /* ---- Create ---- */
  .create-view { max-width: 500px; }

  .form-group { margin-bottom: 10px; }

  .form-label {
    display: block;
    font-size: 0.68rem;
    color: #4a6070;
    margin-bottom: 3px;
  }

  .form-input {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(79,195,247,0.15);
    border-radius: 4px;
    color: #c0cfe0;
    font-size: 0.75rem;
    padding: 6px 8px;
    outline: none;
  }

  .form-input:focus { border-color: rgba(79,195,247,0.4); }

  .form-hint {
    font-size: 0.6rem;
    color: #37474f;
    margin-left: 6px;
  }

  /* ---- Invites ---- */
  .invites-view { display: flex; flex-direction: column; gap: 6px; }

  .invite-list { display: flex; flex-direction: column; gap: 6px; }

  .invite-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(79,195,247,0.1);
    border-radius: 4px;
    gap: 8px;
    flex-wrap: wrap;
  }

  .invite-info { display: flex; flex-direction: column; gap: 2px; }
  .invite-name { font-size: 0.8rem; color: #b0bec5; }
  .invite-from { font-size: 0.63rem; color: #546e7a; }
  .invite-actions { display: flex; gap: 4px; }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
