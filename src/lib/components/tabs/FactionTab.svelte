<script lang="ts">
  import Card, { Content } from '@smui/card';
  import Button, { Label } from '@smui/button';
  import { factionStore } from '$lib/stores/faction.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';

  function refreshFaction() {
    if (playerStore.faction_id) {
      ws.getFactionInfo(playerStore.faction_id);
    }
  }
</script>

<div class="three-col">
  <!-- Faction Overview -->
  <Card class="space-card">
    <Content>
      <div class="section-head">
        <span class="tab-section-title">My Faction</span>
        <button class="icon-btn" onclick={refreshFaction}>↻</button>
      </div>

      {#if factionStore.data}
        <h2 class="faction-name">{factionStore.name}</h2>
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
      {:else if playerStore.faction_id}
        <p class="empty-hint">Click ↻ to load faction info</p>
      {:else}
        <p class="empty-hint">You are not in a faction</p>
      {/if}
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
                style="font-size:0.65rem"
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

<style>
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
    font-size: 1rem;
    padding: 2px 4px;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .faction-name {
    font-size: 1.2rem;
    font-weight: 300;
    letter-spacing: 0.06em;
    color: #b39ddb;
    margin: 0 0 8px 0;
  }

  .faction-desc {
    font-size: 0.75rem;
    color: #546e7a;
    margin: 0 0 12px 0;
  }

  .faction-stats { display: flex; flex-direction: column; gap: 6px; }

  .f-stat {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .f-label { color: #4a6070; }
  .f-val { color: #90a4ae; }
  .f-val.war { color: #ef5350; }
  .credits { color: #ffd700; }
  .mono { font-family: 'Roboto Mono', monospace; }

  .member-list { display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; }

  .member-item {
    padding: 6px 8px;
    background: rgba(255,255,255,0.02);
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.04);
  }

  .member-info { display: flex; justify-content: space-between; align-items: center; }
  .member-name { font-size: 0.8rem; color: #b0bec5; }
  .member-role { font-size: 0.62rem; color: #546e7a; }
  .member-role.leader { color: #ffd700; }
  .member-role.officer { color: #b39ddb; }

  .war-list { display: flex; flex-direction: column; gap: 6px; }

  .war-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: rgba(244,67,54,0.06);
    border: 1px solid rgba(244,67,54,0.15);
    border-radius: 4px;
    gap: 8px;
    flex-wrap: wrap;
  }

  .war-name { font-size: 0.8rem; color: #ef5350; }
  .war-stats { display: flex; gap: 8px; font-size: 0.68rem; }
  .kills { color: #4caf50; }
  .losses { color: #ef5350; }

  .ally-list { display: flex; flex-direction: column; gap: 4px; }

  .ally-item {
    padding: 5px 8px;
    background: rgba(76,175,80,0.06);
    border: 1px solid rgba(76,175,80,0.15);
    border-radius: 3px;
    font-size: 0.78rem;
    color: #66bb6a;
  }
</style>
