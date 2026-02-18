<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';

  function switchShip(shipId: string) {
    ws.switchShip(shipId);
  }

  function sellShip(shipId: string) {
    if (confirm(`Sell ship ${shipId}?`)) ws.sellShip(shipId);
  }

  function buyShip(shipType: string) {
    if (confirm(`Buy ${shipType}?`)) ws.buyShip(shipType);
  }

  function refreshFleet() {
    ws.listShips();
    ws.getShipCatalog();
  }
</script>

<div class="three-col">
  <!-- Current Ship -->
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
          <span class="mono stat-val">{shipStore.cargoUsed.toFixed(0)}/{shipStore.current.max_cargo}</span>
        </div>

        <div class="cpu-power">
          <span class="mono dim">CPU: {shipStore.current.cpu_used}/{shipStore.current.cpu_max}</span>
          <span class="mono dim">PWR: {shipStore.current.power_used}/{shipStore.current.power_max}</span>
        </div>

        {#if shipStore.current.modules.length > 0}
          <p class="tab-section-title" style="margin-top:14px">Modules</p>
          <div class="module-list">
            {#each shipStore.current.modules as mod}
              <div class="module-item" class:active={mod.active}>
                <span class="mod-name">{mod.name}</span>
                <span class="mod-type mono">{mod.type}</span>
                <span class="mod-wear mono" class:warn={mod.wear > 70}>
                  {mod.wear}% wear
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

  <!-- Fleet -->
  <Card class="space-card">
    <Content>
      <div class="section-head">
        <span class="tab-section-title">My Fleet</span>
        <button class="icon-btn" onclick={refreshFleet} title="Refresh">↻</button>
      </div>

      {#if shipStore.fleet.length > 0}
        <div class="fleet-list">
          {#each shipStore.fleet as ship}
            <div class="fleet-item" class:active={ship.id === shipStore.activeShipId}>
              <div class="fleet-info">
                <span class="fleet-name">{ship.name}</span>
                <span class="fleet-type mono">{ship.type}</span>
                <div class="fleet-bars">
                  <LinearProgress progress={ship.hull / ship.max_hull} class="progress-hull" style="height:4px" />
                </div>
              </div>
              <div class="fleet-btns">
                {#if ship.id !== shipStore.activeShipId}
                  <button class="action-btn switch-btn" onclick={() => switchShip(ship.id)}>
                    Switch
                  </button>
                  <button class="action-btn sell-btn" onclick={() => sellShip(ship.id)}>
                    Sell
                  </button>
                {:else}
                  <span class="active-badge">ACTIVE</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">Fleet data not loaded</p>
      {/if}

      <Button variant="outlined" onclick={refreshFleet} style="width:100%;margin-top:12px">
        <Label>Refresh Fleet</Label>
      </Button>
    </Content>
  </Card>

  <!-- Shipyard -->
  <Card class="space-card">
    <Content>
      <p class="tab-section-title">Shipyard</p>
      {#if !playerStore.isDocked}
        <p class="empty-hint">Dock at a station with a shipyard to browse ships.</p>
      {:else if shipStore.catalog.length > 0}
        <div class="catalog-list">
          {#each shipStore.catalog as shipClass}
            <div class="catalog-item">
              <div class="catalog-info">
                <span class="catalog-name">{shipClass.name}</span>
                <span class="catalog-class mono">{shipClass.class}</span>
                <p class="catalog-desc">{shipClass.description}</p>
                <div class="catalog-stats mono">
                  Hull: {shipClass.base_hull} | Shield: {shipClass.base_shields}
                  | Cargo: {shipClass.base_cargo} m³
                </div>
              </div>
              <div class="catalog-buy">
                <span class="catalog-price credits">₡{shipClass.price.toLocaleString()}</span>
                <button class="action-btn buy-btn" onclick={() => buyShip(shipClass.id)}>Buy</button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-hint">No ships in catalog</p>
        <Button variant="outlined" onclick={() => ws.getShipCatalog()} style="width:100%;margin-top:8px">
          <Label>Load Catalog</Label>
        </Button>
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

  .icon-btn:hover { color: #90caf9; }

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

  .fleet-list { display: flex; flex-direction: column; gap: 6px; }

  .fleet-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 4px;
  }

  .fleet-item.active { border-color: rgba(79,195,247,0.3); }

  .fleet-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .fleet-name { font-size: 0.8rem; color: #b0bec5; }
  .fleet-type { font-size: 0.65rem; color: #546e7a; }
  .fleet-bars { width: 100%; margin-top: 4px; }
  .fleet-btns { display: flex; gap: 4px; margin-left: 8px; }

  .action-btn {
    background: none;
    border: 1px solid rgba(255,255,255,0.1);
    color: #78909c;
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .switch-btn { border-color: rgba(79,195,247,0.3); color: #4fc3f7; }
  .switch-btn:hover { background: rgba(79,195,247,0.1); }

  .sell-btn { border-color: rgba(244,67,54,0.3); color: #ef5350; }
  .sell-btn:hover { background: rgba(244,67,54,0.1); }

  .buy-btn { border-color: rgba(76,175,80,0.3); color: #4caf50; }
  .buy-btn:hover { background: rgba(76,175,80,0.1); }

  .active-badge {
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    color: #4fc3f7;
    background: rgba(79,195,247,0.1);
    border: 1px solid rgba(79,195,247,0.3);
    border-radius: 2px;
    padding: 2px 6px;
  }

  .catalog-list { display: flex; flex-direction: column; gap: 8px; }

  .catalog-item {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 4px;
  }

  .catalog-info { flex: 1; }
  .catalog-name { font-size: 0.85rem; color: #b0bec5; display: block; }
  .catalog-class { font-size: 0.65rem; color: #546e7a; }
  .catalog-desc { font-size: 0.7rem; color: #4a6070; margin: 4px 0; }
  .catalog-stats { font-size: 0.65rem; color: #37474f; }

  .catalog-buy {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    margin-left: 8px;
  }

  .catalog-price { font-family: 'Roboto Mono', monospace; font-size: 0.78rem; }
  .credits { color: #ffd700; }
  .mono { font-family: 'Roboto Mono', monospace; }
</style>
