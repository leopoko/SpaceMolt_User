<script lang="ts">
  import Card, { Content } from '@smui/card';
  import { missionStore } from '$lib/stores/mission.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { actionQueueStore } from '$lib/stores/actionQueue.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { ws } from '$lib/services/websocket';
  import type { Mission } from '$lib/types/game';

  // Auto-load: docked → get_missions (chains to get_active_missions)
  //            undocked → get_active_missions only
  $effect(() => {
    if (uiStore.activeTab.label === 'Trading') {
      if (playerStore.isDocked) {
        ws.getMissions();
      } else {
        ws.getActiveMissions();
      }
    }
  });

  let expandedAvailable = $state<Set<string>>(new Set());
  let expandedActive = $state<Set<string>>(new Set());

  function toggleAvailable(id: string) {
    const next = new Set(expandedAvailable);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedAvailable = next;
  }

  function toggleActive(id: string) {
    const next = new Set(expandedActive);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedActive = next;
  }

  function getMissionId(m: Mission): string {
    return m.mission_id ?? m.id;
  }

  function acceptMission(m: Mission) {
    const id = getMissionId(m);
    actionQueueStore.enqueue(`Accept: ${m.title}`, () => ws.acceptMission(id));
  }

  function completeMission(m: Mission) {
    const id = getMissionId(m);
    actionQueueStore.enqueue(`Complete: ${m.title}`, () => ws.completeMission(id));
  }

  function abandonMission(m: Mission) {
    const id = getMissionId(m);
    actionQueueStore.enqueue(`Abandon: ${m.title}`, () => ws.abandonMission(id));
  }

  function refreshMissions() {
    if (playerStore.isDocked) {
      ws.getMissions();
    } else {
      ws.getActiveMissions();
    }
  }

  function objectiveProgress(obj: { current?: number; target?: number }): number {
    const target = obj.target ?? 1;
    const current = obj.current ?? 0;
    if (target <= 0) return 100;
    return Math.min(100, Math.round((current / target) * 100));
  }

  function difficultyLabel(d: number): string {
    if (d <= 1) return 'Easy';
    if (d <= 3) return 'Medium';
    if (d <= 5) return 'Hard';
    return 'Extreme';
  }

  function difficultyClass(d: number): string {
    if (d <= 1) return 'diff-easy';
    if (d <= 3) return 'diff-medium';
    if (d <= 5) return 'diff-hard';
    return 'diff-extreme';
  }

  function getGiverDisplay(m: Mission): string {
    if (m.giver) {
      return m.giver.title ? `${m.giver.name} — ${m.giver.title}` : m.giver.name;
    }
    return m.giver_name ?? '';
  }

  function getOfferDialog(m: Mission): string {
    return m.dialog?.offer ?? m.giver_dialog ?? '';
  }
</script>

<div class="mission-layout">
  <!-- Active Missions -->
  <Card class="space-card">
    <Content>
      <div class="section-header">
        <p class="tab-section-title">Active Missions</p>
        <button class="refresh-btn" onclick={refreshMissions} title="Refresh missions">
          <span class="material-icons" style="font-size:14px">refresh</span>
        </button>
        <span class="mission-count">{missionStore.active.length}/{missionStore.maxMissions}</span>
      </div>

      {#if missionStore.loadingActive}
        <p class="empty-hint">Loading...</p>
      {:else if missionStore.active.length > 0}
        <div class="mission-list">
          {#each missionStore.active as mission (getMissionId(mission))}
            {@const mid = getMissionId(mission)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="mission-card" class:expanded={expandedActive.has(mid)} onclick={() => toggleActive(mid)}>
              <div class="mission-header">
                <span class="material-icons expand-icon" style="font-size:14px">
                  {expandedActive.has(mid) ? 'expand_more' : 'chevron_right'}
                </span>
                <span class="mission-title">{mission.title}</span>
                {#if mission.type}
                  <span class="mission-type-badge">{mission.type}</span>
                {/if}
                <span class="mission-reward mono">₡{mission.reward_credits.toLocaleString()}</span>
              </div>

              {#if expandedActive.has(mid)}
                <div class="mission-detail">
                  <p class="mission-desc">{mission.description}</p>

                  {#if mission.objectives && mission.objectives.length > 0}
                    <div class="objectives">
                      <p class="obj-title">Objectives</p>
                      {#each mission.objectives as obj}
                        {@const hasProgress = obj.current != null && obj.target != null}
                        <div class="objective-row">
                          <span class="material-icons obj-icon" style="font-size:12px" class:obj-done={obj.complete}>
                            {obj.complete ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span class="obj-text" class:obj-done={obj.complete}>{obj.description}</span>
                          {#if hasProgress}
                            <span class="obj-progress mono">{obj.current}/{obj.target}</span>
                            <div class="obj-bar">
                              <div class="obj-bar-fill" style="width:{objectiveProgress(obj)}%"></div>
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if mission.destination_name}
                    <p class="mission-meta">
                      <span class="material-icons" style="font-size:12px">place</span>
                      {mission.destination_name}
                    </p>
                  {/if}

                  {#if mission.reward_items && mission.reward_items.length > 0}
                    <p class="mission-meta">
                      <span class="material-icons" style="font-size:12px">inventory_2</span>
                      Rewards: {mission.reward_items.map(i => `${i.quantity}x ${i.name ?? i.item_id}`).join(', ')}
                    </p>
                  {/if}

                  {#if mission.reward_xp}
                    <p class="mission-meta">
                      <span class="material-icons" style="font-size:12px">trending_up</span>
                      XP: {Object.entries(mission.reward_xp).map(([k, v]) => `${k}: +${v}`).join(', ')}
                    </p>
                  {/if}

                  <div class="mission-actions">
                    {#if playerStore.isDocked}
                      <button class="action-btn complete-btn" onclick={(e) => { e.stopPropagation(); completeMission(mission); }}>
                        <span class="material-icons" style="font-size:12px">check</span> Complete
                      </button>
                    {/if}
                    <button class="action-btn abandon-btn" onclick={(e) => { e.stopPropagation(); abandonMission(mission); }}>
                      <span class="material-icons" style="font-size:12px">close</span> Abandon
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No active missions</p>
      {/if}
    </Content>
  </Card>

  <!-- Available Missions (docked only) -->
  <Card class="space-card">
    <Content>
      <div class="section-header">
        <p class="tab-section-title">Available Missions</p>
        {#if missionStore.baseName}
          <span class="station-label mono">{missionStore.baseName}</span>
        {/if}
      </div>

      {#if !playerStore.isDocked}
        <p class="empty-hint">Dock at a station with mission services to view available missions.</p>
      {:else if missionStore.loadingAvailable}
        <p class="empty-hint">Loading...</p>
      {:else if missionStore.available.length > 0}
        <div class="mission-list">
          {#each missionStore.available as mission (getMissionId(mission))}
            {@const mid = getMissionId(mission)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="mission-card available" class:expanded={expandedAvailable.has(mid)} onclick={() => toggleAvailable(mid)}>
              <div class="mission-header">
                <span class="material-icons expand-icon" style="font-size:14px">
                  {expandedAvailable.has(mid) ? 'expand_more' : 'chevron_right'}
                </span>
                <span class="mission-title">{mission.title}</span>
                {#if mission.type}
                  <span class="mission-type-badge">{mission.type}</span>
                {/if}
                <span class="difficulty-badge {difficultyClass(mission.difficulty)}">{difficultyLabel(mission.difficulty)}</span>
                {#if mission.repeatable}
                  <span class="repeatable-badge">RPT</span>
                {/if}
                <span class="mission-reward mono">₡{mission.reward_credits.toLocaleString()}</span>
              </div>

              {#if expandedAvailable.has(mid)}
                <div class="mission-detail">
                  <p class="mission-desc">{mission.description}</p>

                  {#if getGiverDisplay(mission)}
                    <p class="mission-giver">
                      <span class="material-icons" style="font-size:12px">person</span>
                      {getGiverDisplay(mission)}
                    </p>
                  {/if}

                  {#if getOfferDialog(mission)}
                    <p class="mission-dialog">"{getOfferDialog(mission)}"</p>
                  {/if}

                  {#if mission.objectives && mission.objectives.length > 0}
                    <div class="objectives">
                      <p class="obj-title">Objectives</p>
                      {#each mission.objectives as obj}
                        <div class="objective-row">
                          <span class="material-icons obj-icon" style="font-size:12px">radio_button_unchecked</span>
                          <span class="obj-text">{obj.description}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if mission.reward_xp}
                    <p class="mission-meta">
                      <span class="material-icons" style="font-size:12px">trending_up</span>
                      XP: {Object.entries(mission.reward_xp).map(([k, v]) => `${k}: +${v}`).join(', ')}
                    </p>
                  {/if}

                  {#if mission.reward_items && mission.reward_items.length > 0}
                    <p class="mission-meta">
                      <span class="material-icons" style="font-size:12px">inventory_2</span>
                      Rewards: {mission.reward_items.map(i => `${i.quantity}x ${i.name ?? i.item_id}`).join(', ')}
                    </p>
                  {/if}

                  {#if mission.chain_next}
                    <p class="mission-meta">
                      <span class="material-icons" style="font-size:12px">link</span>
                      Chain mission (continues after completion)
                    </p>
                  {/if}

                  <div class="mission-actions">
                    <button class="action-btn accept-btn" onclick={(e) => { e.stopPropagation(); acceptMission(mission); }}>
                      <span class="material-icons" style="font-size:12px">check</span> Accept
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No missions available at this station.</p>
      {/if}
    </Content>
  </Card>
</div>

<style>
  .mission-layout {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .section-header .tab-section-title {
    margin: 0;
  }

  .station-label {
    font-size: 0.65rem;
    color: #546e7a;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    background: none;
    border: 1px solid rgba(79, 195, 247, 0.2);
    color: #4fc3f7;
    border-radius: 3px;
    padding: 2px 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .refresh-btn:hover { background: rgba(79, 195, 247, 0.1); }

  .mission-count {
    font-size: 0.65rem;
    font-family: 'Roboto Mono', monospace;
    color: #546e7a;
    margin-left: auto;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #546e7a;
    text-align: center;
    padding: 18px 0;
  }

  .mission-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mission-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    padding: 6px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .mission-card:hover { background: rgba(79, 195, 247, 0.04); }
  .mission-card.expanded { background: rgba(79, 195, 247, 0.06); border-color: rgba(79, 195, 247, 0.15); }
  .mission-card.available { border-left: 2px solid rgba(76, 175, 80, 0.4); }

  .mission-header {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .expand-icon { color: #37474f; flex-shrink: 0; }

  .mission-title {
    font-size: 0.76rem;
    font-weight: 500;
    color: #b0bec5;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mission-type-badge {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    text-transform: uppercase;
    color: #4fc3f7;
    background: rgba(79, 195, 247, 0.1);
    border: 1px solid rgba(79, 195, 247, 0.2);
    border-radius: 2px;
    padding: 0 4px;
    flex-shrink: 0;
  }

  .difficulty-badge {
    font-size: 0.55rem;
    font-family: 'Roboto Mono', monospace;
    text-transform: uppercase;
    border-radius: 2px;
    padding: 0 4px;
    flex-shrink: 0;
  }
  .diff-easy { color: #4caf50; background: rgba(76,175,80,0.1); border: 1px solid rgba(76,175,80,0.25); }
  .diff-medium { color: #ff9800; background: rgba(255,152,0,0.1); border: 1px solid rgba(255,152,0,0.25); }
  .diff-hard { color: #f44336; background: rgba(244,67,54,0.1); border: 1px solid rgba(244,67,54,0.25); }
  .diff-extreme { color: #e040fb; background: rgba(224,64,251,0.1); border: 1px solid rgba(224,64,251,0.25); }

  .repeatable-badge {
    font-size: 0.5rem;
    font-family: 'Roboto Mono', monospace;
    color: #ffd700;
    background: rgba(255, 215, 0, 0.1);
    border: 1px solid rgba(255, 215, 0, 0.25);
    border-radius: 2px;
    padding: 0 3px;
    flex-shrink: 0;
  }

  .mission-reward {
    font-size: 0.7rem;
    color: #ffd700;
    flex-shrink: 0;
  }

  .mono { font-family: 'Roboto Mono', monospace; }

  .mission-detail {
    padding: 8px 0 4px 20px;
  }

  .mission-desc {
    font-size: 0.7rem;
    color: #78909c;
    margin-bottom: 8px;
    line-height: 1.4;
  }

  .mission-giver {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.65rem;
    color: #4fc3f7;
    margin-bottom: 6px;
  }

  .mission-dialog {
    font-size: 0.68rem;
    color: #90a4ae;
    font-style: italic;
    margin-bottom: 8px;
    padding-left: 8px;
    border-left: 2px solid rgba(79, 195, 247, 0.2);
    line-height: 1.5;
  }

  .objectives {
    margin-bottom: 8px;
  }

  .obj-title {
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #546e7a;
    margin-bottom: 4px;
  }

  .objective-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }

  .obj-icon { color: #546e7a; flex-shrink: 0; }
  .obj-icon.obj-done { color: #4caf50; }

  .obj-text {
    font-size: 0.68rem;
    color: #90a4ae;
    flex: 1;
  }
  .obj-text.obj-done { color: #4caf50; text-decoration: line-through; }

  .obj-progress {
    font-size: 0.6rem;
    color: #546e7a;
    flex-shrink: 0;
  }

  .obj-bar {
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .obj-bar-fill {
    height: 100%;
    background: #4fc3f7;
    border-radius: 2px;
    transition: width 0.3s;
  }

  .mission-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.65rem;
    color: #546e7a;
    margin-bottom: 4px;
  }

  .mission-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    color: #78909c;
    font-size: 0.65rem;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .accept-btn { border-color: rgba(76,175,80,0.3); color: #4caf50; }
  .accept-btn:hover { background: rgba(76,175,80,0.1); }

  .complete-btn { border-color: rgba(79,195,247,0.3); color: #4fc3f7; }
  .complete-btn:hover { background: rgba(79,195,247,0.1); }

  .abandon-btn { border-color: rgba(244,67,54,0.3); color: #ef5350; }
  .abandon-btn:hover { background: rgba(244,67,54,0.1); }
</style>
