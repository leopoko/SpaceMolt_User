<script lang="ts">
  import Button, { Label } from '@smui/button';
  import Card, { Content } from '@smui/card';
  import LinearProgress from '@smui/linear-progress';
  import { shipStore } from '$lib/stores/ship.svelte';
  import { ws } from '$lib/services/websocket';

  // Auto-refresh fleet when this sub-tab mounts
  $effect(() => {
    ws.listShips();
  });

  function switchShip(shipId: string) {
    ws.switchShip(shipId);
  }

  function sellShip(shipId: string) {
    if (confirm(`Sell ship ${shipId}?`)) ws.sellShip(shipId);
  }

  function refreshFleet() {
    ws.listShips();
  }
</script>

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

  .active-badge {
    font-size: 0.6rem;
    font-family: 'Roboto Mono', monospace;
    color: #4fc3f7;
    background: rgba(79,195,247,0.1);
    border: 1px solid rgba(79,195,247,0.3);
    border-radius: 2px;
    padding: 2px 6px;
  }

  .mono { font-family: 'Roboto Mono', monospace; }
</style>
