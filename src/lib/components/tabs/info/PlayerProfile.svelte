<script lang="ts">
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { playerStore } from '$lib/stores/player.svelte';
  import { authStore } from '$lib/stores/auth.svelte';

  const missionStatusColor: Record<string, string> = {
    available: '#4fc3f7',
    active: '#ff9800',
    complete: '#4caf50',
    failed: '#ef5350'
  };
</script>

<div class="three-col">
  <!-- Player Profile -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Player Profile</p>

      {#if playerStore.data}
        <div class="profile-header">
          <span class="material-icons profile-icon">person</span>
          <div>
            <h2 class="player-name">{playerStore.data.username}</h2>
            <p class="player-empire mono">{playerStore.empire}</p>
          </div>
        </div>

        <div class="profile-stats">
          <div class="ps">
            <span class="ps-label">Status</span>
            <span class="ps-val mono" class:docked={playerStore.isDocked}>{playerStore.status.toUpperCase()}</span>
          </div>
          <div class="ps">
            <span class="ps-label">Faction</span>
            <span class="ps-val">{playerStore.faction_id ?? 'None'}</span>
          </div>
          <div class="ps">
            <span class="ps-label">Credits</span>
            <span class="ps-val mono credits">₡ {playerStore.credits.toLocaleString()}</span>
          </div>
          <div class="ps">
            <span class="ps-label">Location</span>
            <span class="ps-val">{playerStore.location}</span>
          </div>
          <div class="ps">
            <span class="ps-label">Insurance</span>
            <span class="ps-val" class:insured={playerStore.data.insurance}>
              {playerStore.data.insurance ? '✓ Active' : '✗ None'}
            </span>
          </div>
        </div>
      {:else}
        <p class="empty-hint">Player data not loaded</p>
      {/if}
    </Content>
  </Card>

  <!-- Skills -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Skills ({playerStore.skills.length})</p>

      {#if playerStore.skills.length > 0}
        <div class="skill-list">
          {#each playerStore.skills as skill}
            <div class="skill-item">
              <div class="skill-header">
                <span class="skill-name">{skill.name}</span>
                <span class="skill-level mono">Lv {skill.level}/{skill.max_level}</span>
              </div>
              {#if skill.xp !== undefined && skill.xp > 0}
                <div class="xp-bar">
                  {#if skill.next_level_xp > 0}
                    <LinearProgress
                      progress={skill.xp / skill.next_level_xp}
                      style="height:3px; --mdc-theme-primary:#7c4dff;"
                    />
                    <span class="xp-text mono">{skill.xp}/{skill.next_level_xp} XP</span>
                  {:else}
                    <span class="xp-text mono">{skill.xp} XP</span>
                  {/if}
                </div>
              {/if}
              {#if skill.description}
                <p class="skill-desc">{skill.description}</p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No skill data</p>
      {/if}
    </Content>
  </Card>

  <!-- Missions -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Missions ({playerStore.missions.length})</p>

      {#if playerStore.missions.length > 0}
        <div class="mission-list">
          {#each playerStore.missions as mission}
            <div class="mission-item">
              <div class="mission-header">
                <span class="mission-title">{mission.title}</span>
                <span class="mission-status" style="color:{missionStatusColor[mission.status] ?? '#546e7a'}">
                  {mission.status.toUpperCase()}
                </span>
              </div>
              <p class="mission-desc">{mission.description}</p>

              {#if mission.objectives.length > 0}
                <div class="objectives">
                  {#each mission.objectives as obj}
                    <div class="objective" class:complete={obj.complete}>
                      <span class="obj-check">{obj.complete ? '✓' : '○'}</span>
                      <span class="obj-text">{obj.description}</span>
                      {#if !obj.complete && obj.target > 0}
                        <span class="obj-progress mono">({obj.current}/{obj.target})</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}

              <div class="mission-reward">
                Reward: <span class="mono credits">₡{mission.reward_credits.toLocaleString()}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No missions</p>
      {/if}

      <!-- Achievements -->
      {#if playerStore.achievements.length > 0}
        <p class="tab-section-title" style="margin-top:16px">
          Achievements ({playerStore.achievements.filter(a => a.unlocked).length}/{playerStore.achievements.length})
        </p>
        <div class="achievement-list">
          {#each playerStore.achievements.filter(a => a.unlocked) as ach}
            <div class="achievement-item">
              <span class="material-icons ach-icon">emoji_events</span>
              <div>
                <span class="ach-name">{ach.name}</span>
                <p class="ach-desc">{ach.description}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </Content>
  </Card>
</div>

<style>
  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .profile-icon { font-size: 40px; color: #37474f; }

  .player-name { font-size: 1.1rem; font-weight: 300; color: #90caf9; margin: 0; }
  .player-empire { font-size: 0.7rem; color: #546e7a; margin: 2px 0 0; }

  .profile-stats { display: flex; flex-direction: column; gap: 5px; }

  .ps {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .ps-label { color: #4a6070; }
  .ps-val { color: #90a4ae; }
  .ps-val.docked { color: #4caf50; }
  .ps-val.insured { color: #4caf50; }
  .credits { color: #ffd700; }
  .mono { font-family: 'Roboto Mono', monospace; }

  .skill-list { display: flex; flex-direction: column; gap: 8px; max-height: 460px; overflow-y: auto; }

  .skill-item {
    padding: 7px 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 4px;
  }

  .skill-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .skill-name { font-size: 0.8rem; color: #b0bec5; }
  .skill-level { font-size: 0.68rem; color: #7c4dff; }
  .xp-bar { margin-top: 4px; }
  .xp-text { font-size: 0.62rem; color: #37474f; }
  .skill-desc { font-size: 0.68rem; color: #4a6070; margin: 3px 0 0; }

  .mission-list { display: flex; flex-direction: column; gap: 8px; }

  .mission-item {
    padding: 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 4px;
  }

  .mission-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .mission-title { font-size: 0.8rem; color: #b0bec5; }
  .mission-status { font-size: 0.62rem; font-family: 'Roboto Mono', monospace; }
  .mission-desc { font-size: 0.7rem; color: #546e7a; margin: 0 0 6px; }

  .objectives { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }

  .objective {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    color: #546e7a;
  }

  .objective.complete .obj-text { color: #4caf50; text-decoration: line-through; }
  .obj-check { font-size: 0.75rem; }
  .obj-progress { color: #37474f; }

  .mission-reward { font-size: 0.7rem; color: #4a6070; }

  .achievement-list { display: flex; flex-direction: column; gap: 4px; }

  .achievement-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: rgba(255,215,0,0.05);
    border: 1px solid rgba(255,215,0,0.1);
    border-radius: 4px;
  }

  .ach-icon { font-size: 18px; color: #ffd700; }
  .ach-name { font-size: 0.78rem; color: #ffd700; display: block; }
  .ach-desc { font-size: 0.68rem; color: #546e7a; margin: 0; }
</style>
