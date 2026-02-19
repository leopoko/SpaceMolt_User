<script lang="ts">
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { shipStore } from '$lib/stores/ship.svelte';

</script>

<Card class="space-card">
  <Content>
    <p class="tab-section-title">Active Ship</p>

    {#if shipStore.current}
      <h3 class="ship-name">{shipStore.current.name}</h3>
      <p class="ship-type mono">{shipStore.current.type} · {shipStore.current.class}</p>

      <div class="stat-row">
        <span class="stat-name">Hull</span>
        <LinearProgress progress={shipStore.hullPercent / 100} class="progress-hull" />
        <span class="mono stat-val">{shipStore.current.hull}/{shipStore.current.max_hull}</span>
      </div>
      <div class="stat-row">
        <span class="stat-name">Shield</span>
        <LinearProgress progress={shipStore.shieldPercent / 100} class="progress-shield" />
        <span class="mono stat-val">{shipStore.current.shields}/{shipStore.current.max_shields}</span>
      </div>
      <div class="stat-row">
        <span class="stat-name">Fuel</span>
        <LinearProgress progress={shipStore.fuelPercent / 100} class="progress-fuel" />
        <span class="mono stat-val">{shipStore.current.fuel}/{shipStore.current.max_fuel}</span>
      </div>
      <div class="stat-row">
        <span class="stat-name">Cargo</span>
        <LinearProgress progress={shipStore.cargoPercent / 100} style="--mdc-theme-primary:#ff9800" />
        <span class="mono stat-val">{shipStore.cargoUsed.toFixed(0)}/{shipStore.cargoCapacity}</span>
      </div>

      <div class="cpu-power">
        <span class="mono dim">CPU: {shipStore.cpuUsed}/{shipStore.cpuCapacity}</span>
        <span class="mono dim">PWR: {shipStore.powerUsed}/{shipStore.powerCapacity}</span>
      </div>

      {#if shipStore.moduleData.length > 0}
        <p class="tab-section-title" style="margin-top:14px">Modules</p>
        <div class="module-list">
          {#each shipStore.moduleData as mod}
            <div class="module-item" class:active={mod.active ?? true}>
              <span class="mod-name">{mod.name}</span>
              <span class="mod-type mono">{mod.type_id ?? mod.type}</span>
              <span class="mod-wear mono" class:warn={(mod.wear ?? 0) > 70}>
                {mod.wear_status ?? `${mod.wear ?? 0}% wear`}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <p class="empty-hint">No ship data</p>
    {/if}
  </Content>
</Card>

<style>
  .ship-name {
    font-size: 1.1rem;
    font-weight: 300;
    color: #90caf9;
    margin: 0 0 2px 0;
  }

  .ship-type { font-size: 0.72rem; color: #546e7a; margin-bottom: 12px; }

  .stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .stat-name { font-size: 0.7rem; color: #4a6070; width: 44px; flex-shrink: 0; }
  .stat-val { font-size: 0.68rem; color: #607d8b; width: 64px; text-align: right; flex-shrink: 0; }

  .cpu-power {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    font-size: 0.68rem;
  }

  .dim { color: #37474f; }

  .module-list { display: flex; flex-direction: column; gap: 4px; }

  .module-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 3px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
  }

  .module-item.active { border-color: rgba(76,175,80,0.2); }

  .mod-name { font-size: 0.75rem; color: #90a4ae; flex: 1; }
  .mod-type { font-size: 0.65rem; color: #4a6070; }
  .mod-wear { font-size: 0.65rem; color: #607d8b; }
  .mod-wear.warn { color: #ff7043; }

  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
  }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
