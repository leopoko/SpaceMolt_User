<script lang="ts">
  import LinearProgress from '@smui/linear-progress';
  import { connectionStore } from '$lib/stores/connection.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { systemStore } from '$lib/stores/system.svelte';

  const statusColor: Record<string, string> = {
    connected: '#4caf50',
    connecting: '#ff9800',
    disconnected: '#f44336',
    error: '#f44336'
  };

  const secColor: Record<string, string> = {
    high: '#4caf50',
    medium: '#ff9800',
    low: '#f44336',
    null: '#9c27b0'
  };
</script>

<div class="status-bar">
  <!-- Connection -->
  <span class="mono" style="color:{statusColor[connectionStore.status]}">
    ● {connectionStore.status.toUpperCase()}
  </span>

  <span class="sep">|</span>

  <!-- Tick -->
  <span class="mono dim">T:{connectionStore.tick}</span>

  <span class="sep">|</span>

  <!-- Credits -->
  <span class="credits mono">₡ {playerStore.credits.toLocaleString()}</span>

  <span class="sep">|</span>

  <!-- Location -->
  <span class="location">
    {systemStore.name}
    {#if systemStore.data}
      <span style="color:{secColor[systemStore.securityLevel]}">
        [{systemStore.securityLevel.toUpperCase()}]
      </span>
    {/if}
    {#if playerStore.isDocked}
      <span class="docked-badge">DOCKED</span>
    {/if}
  </span>

  {#if shipStore.current}
    <span class="sep">|</span>

    <!-- Hull -->
    <span class="stat-label">Hull</span>
    <div class="progress-wrap">
      <LinearProgress
        progress={shipStore.hullPercent / 100}
        class="progress-hull"
      />
    </div>
    <span class="mono stat-val">{shipStore.current.hull}/{shipStore.current.max_hull}</span>

    <!-- Shield -->
    <span class="stat-label">Shield</span>
    <div class="progress-wrap">
      <LinearProgress
        progress={shipStore.shieldPercent / 100}
        class="progress-shield"
      />
    </div>
    <span class="mono stat-val">{shipStore.current.shields}/{shipStore.current.max_shields}</span>

    <!-- Fuel -->
    <span class="stat-label">Fuel</span>
    <div class="progress-wrap">
      <LinearProgress
        progress={shipStore.fuelPercent / 100}
        class="progress-fuel"
      />
    </div>
  {/if}

  {#if systemStore.travel.in_progress}
    <span class="sep">|</span>
    <span class="traveling">
      ► Traveling
      {#if systemStore.travel.arrival_tick !== null}
        (ETA T:{systemStore.travel.arrival_tick})
      {/if}
    </span>
  {/if}
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 4px 14px;
    background: rgba(4, 8, 18, 0.97);
    border-bottom: 1px solid rgba(79, 195, 247, 0.15);
    font-size: 0.72rem;
    color: #7a9ab8;
    flex-wrap: wrap;
    min-height: 30px;
    position: sticky;
    top: 0;
    z-index: 300;
  }

  .mono { font-family: 'Roboto Mono', monospace; }
  .dim { opacity: 0.5; }

  .sep { opacity: 0.25; }

  .credits { color: #ffd700; font-weight: 500; }

  .location { color: #90caf9; }

  .docked-badge {
    font-size: 0.65rem;
    background: rgba(76, 175, 80, 0.2);
    color: #4caf50;
    border: 1px solid rgba(76, 175, 80, 0.4);
    border-radius: 3px;
    padding: 1px 5px;
    margin-left: 4px;
    vertical-align: middle;
  }

  .stat-label {
    font-size: 0.68rem;
    color: #4a6070;
    white-space: nowrap;
  }

  .stat-val {
    font-size: 0.68rem;
    color: #607d8b;
  }

  .progress-wrap {
    width: 60px;
    height: 6px;
    display: flex;
    align-items: center;
  }

  /* Override SMUI linear progress colours */
  .progress-wrap :global(.mdc-linear-progress__bar-inner) {
    border-color: var(--mdc-theme-primary, currentColor);
  }

  .traveling {
    color: #ffb74d;
    font-size: 0.7rem;
    animation: blink 1.4s infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
</style>
