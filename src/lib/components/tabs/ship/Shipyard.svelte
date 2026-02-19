<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { playerStore } from '$lib/stores/player.svelte';
  import { ws } from '$lib/services/websocket';

  // Auto-refresh catalog when this sub-tab mounts (only when docked)
  $effect(() => {
    if (playerStore.isDocked) {
      ws.getShipCatalog();
    }
  });

  function buyShip(shipType: string) {
    if (confirm(`Buy ${shipType}?`)) ws.buyShip(shipType);
  }
</script>

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

<style>
  .empty-hint {
    font-size: 0.75rem;
    color: #263238;
    text-align: center;
    padding: 12px 0;
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

  .buy-btn { border-color: rgba(76,175,80,0.3); color: #4caf50; }
  .buy-btn:hover { background: rgba(76,175,80,0.1); }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
